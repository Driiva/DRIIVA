#!/usr/bin/env python3
"""
Stop-Go-Classifier
==================
Algorithm for stop and trip classification of raw GPS data.
Transforms a list of position records into intervals of dwelling and transit.

Original source: https://github.com/RGreinacher/Stop-Go-Classifier
License: BSD-3-Clause
Author: Robert Spang, QULab, TU Berlin

Citation:
    Spang, R. P., Pieper, K., Oesterle, B., Brauer, M., Haeger, C., Mümken, S., 
    Gellert, P., Voigt-Antons, J.-N., 2022. Making Sense of the Noise: Integrating 
    Multiple Analyses for Stop and Trip Classification. Proceedings of FOSS4G, 
    Florence, Italy.
"""

from scipy import spatial
import numpy as np
import pandas as pd


class StopGoClassifier:
    """
    Classifier for identifying stops and trips in GPS trajectory data.
    
    The classifier takes planar (x, y) coordinates (NOT lat/lng) and timestamps,
    then identifies significant locations (stops) where a user dwelled.
    
    Usage:
        classifier = StopGoClassifier()
        classifier.read(timestamps, x_coords, y_coords)
        stops_df = classifier.run()
    
    After run(), these attributes are available:
        - samples_df: All GPS samples with classification labels
        - stop_df: List of detected stop intervals
        - trip_df: List of detected trip intervals
        - trip_samples_df: GPS samples within trip intervals
    """

    def __init__(self, overwrite_settings=None):
        # Initialize members
        self.original_df = None
        self.samples_df = pd.DataFrame()
        self.stop_df = pd.DataFrame()
        self.debug_stop_merge_df = None
        self.trip_df = None
        self.trip_samples_df = None
        
        # Default settings
        self.settings = {
            # Time thresholds
            'MIN_STOP_INTERVAL': 63,  # seconds; stops below this will be ignored
            'RELEVANT_STOP_DURATION': 178,  # seconds; stops longer than this always kept
            
            # Distance thresholds
            'MIN_DISTANCE_BETWEEN_STOP': 37,  # meters; min distance between consecutive stops
            'RELEVANT_DISTANCE_BETWEEN_STOP': 165,  # meters; stops with this distance always kept
            'MIN_TIME_BETWEEN_STOPS': 69,  # seconds; remove or merge if less
            'RELEVANT_TIME_BETWEEN_STOPS': 131,  # seconds; trip is relevant if longer
            'MAX_TIME_BETWEEN_STOPS_FOR_MERGE': 175,  # seconds; won't merge stops with more time

            # METHOD 1: Motion Score (from accelerometer)
            'USE_MOTION_SCORE': True,
            'MOTION_SCORE_LOWER_CUTOFF': 0.29,
            'MOTION_SCORE_THRESHOLD': 1.30,
            'MOTION_SCORE_UPPER_CUTOFF': 3.00,

            # METHOD 2: Rectangle distance ratio
            'USE_METHOD_RDR': True,
            'METHOD_RECTANGLE_DISTANCE_WINDOW_SIZE': 23,
            'METHOD_RECTANGLE_DISTANCE_RATIO_THRESHOLD': 1.95,
            'METHOD_RECTANGLE_DISTANCE_RATIO_UPPER_CUTOFF': 2.875,
            'METHOD_RECTANGLE_DISTANCE_RATIO_WEIGHT': 0.735,

            # METHOD 3: Bearing analysis
            'USE_METHOD_BA': True,
            'METHOD_BEARING_ANALYSIS_LOWER_CUTOFF': 31,
            'METHOD_BEARING_ANALYSIS_THRESHOLD': 41,
            'METHOD_BEARING_ANALYSIS_UPPER_CUTOFF': 82,
            'METHOD_BEARING_ANALYSIS_WINDOW_SIZE': 15,
            'METHOD_BEARING_ANALYSIS_WEIGHT': 1.2,

            # METHOD 4: Start-end distance analysis
            'USE_METHOD_SEDA': True,
            'METHOD_START_END_DISTANCE_ANALYSIS_LOWER_CUTOFF': 19,
            'METHOD_START_END_DISTANCE_ANALYSIS_THRESHOLD': 95,
            'METHOD_START_END_DISTANCE_ANALYSIS_UPPER_CUTOFF': 262,
            'METHOD_START_END_DISTANCE_ANALYSIS_WINDOW_SIZE': 14,
            'METHOD_START_END_DISTANCE_ANALYSIS_WEIGHT': 1.125,

            # METHOD 5: Intersecting segments analysis
            'USE_METHOD_ISA': True,
            'METHOD_INTERSECTING_SEGMENTS_ANALYSIS_UPPER_CUTOFF': 4,
            'METHOD_INTERSECTING_SEGMENTS_ANALYSIS_THRESHOLD': 0.75,
            'METHOD_INTERSECTING_SEGMENTS_ANALYSIS_WINDOW_SIZE': 19,
            'METHOD_INTERSECTING_SEGMENTS_ANALYSIS_WEIGHT': 0.43,

            # METHOD 6: Missing data analysis
            'USE_METHOD_MDA': True,
            'MIN_MISSING_DATA_INTERVAL': 53,  # seconds; threshold for data gap detection
            'METHOD_MISSING_DATA_ANALYSIS_LOWER_CUTOFF': 0.39,
            'METHOD_MISSING_DATA_ANALYSIS_THRESHOLD': 1.4,
            'METHOD_MISSING_DATA_ANALYSIS_UPPER_CUTOFF': 26,
        }

        # Apply custom settings
        if overwrite_settings is not None:
            self.settings.update(overwrite_settings)

        # Calculate maximum window size
        self.max_window_size = max([
            self.settings['METHOD_RECTANGLE_DISTANCE_WINDOW_SIZE'],
            self.settings['METHOD_BEARING_ANALYSIS_WINDOW_SIZE'],
            self.settings['METHOD_START_END_DISTANCE_ANALYSIS_WINDOW_SIZE'],
            self.settings['METHOD_INTERSECTING_SEGMENTS_ANALYSIS_WINDOW_SIZE'],
        ])

        # Validate that at least one method is selected
        check_flag = False
        for method_setting in ['USE_METHOD_RDR', 'USE_METHOD_BA', 'USE_METHOD_SEDA']:
            check_flag |= self.settings[method_setting]
        if not check_flag:
            raise Exception("Bad settings: no method selected")

    def read(self, timestamps, x_coordinates, y_coordinates, motion_score=None, index=None):
        """
        Read GPS data into the classifier.
        
        Args:
            timestamps: Array of timestamps (datetime or numeric)
            x_coordinates: Array of x positions (meters, planar projection)
            y_coordinates: Array of y positions (meters, planar projection)
            motion_score: Optional array of motion scores from accelerometer
            index: Optional array of indices
        
        Returns:
            self (for method chaining)
        """
        df = pd.DataFrame()
        df['ts'] = timestamps
        df['x'] = x_coordinates
        df['y'] = y_coordinates
        df['motion_score'] = motion_score

        if index is not None:
            df['index'] = index
        else:
            df['index'] = range(0, df.shape[0])

        # Deactivate motion score if not provided
        if motion_score is None:
            self.settings['USE_MOTION_SCORE'] = False

        # Filter duplicates and NA rows
        df.drop_duplicates(subset=['x', 'y'], keep='first', inplace=True)
        df.dropna(subset=['x', 'y'], inplace=True)
        
        if df.shape[0] < self.max_window_size:
            raise AssertionError(
                f'Classification requires at least {self.max_window_size} unique samples, '
                f'got {df.shape[0]}'
            )

        self.original_df = df
        return self

    def run(self):
        """
        Run the complete classification pipeline.
        
        Returns:
            DataFrame of detected stops with start, stop, duration, x, y columns
        """
        # Classify each sample as stop or trip
        self.process_samples()

        # Aggregate stops
        self.aggregate()

        if self.stop_df.shape[0] > 0:
            # Filter and merge stops
            self.filter_outliers()

        # Isolate GPS records belonging to trips
        self.isolate_trip_samples()

        return self.stop_df

    def process_samples(self):
        """Process GPS samples and classify each as stop or trip."""
        self.samples_df = self.original_df.copy()
        
        # Add attributes
        self.samples_df = StopGoClassifier.add_attributes(self.samples_df, dist=True, bearing=True)
        
        if self.samples_df[self.samples_df.distance_to_next == 0].shape[0] > 0:
            self.samples_df = self.samples_df[self.samples_df.distance_to_next > 0].copy()
            self.samples_df = StopGoClassifier.add_attributes(self.samples_df, bearing=True)

        self.samples_df['key'] = self.samples_df.apply(lambda row: (row.x, row.y), axis=1)
        self.samples_df['id'] = range(self.samples_df.shape[0])
        self.samples_df['uncertain'] = True
        self.samples_df['x_shifted'] = self.samples_df.x.shift(-1)
        self.samples_df['y_shifted'] = self.samples_df.y.shift(-1)

        # Method 1: Motion Score
        if self.settings['USE_MOTION_SCORE']:
            idx_without_ms = self.samples_df[self.samples_df.motion_score.isna()].index
            self.samples_df.loc[idx_without_ms, 'motion_score'] = 0.0
            
            idx_with_ms = self.samples_df[~self.samples_df.index.isin(idx_without_ms)].index
            self.samples_df.loc[idx_with_ms, 'motion_score'] = self.samples_df.loc[idx_with_ms].apply(
                self.compute_motion_score, axis=1
            )
            
            assured_stop_idx = self.samples_df[self.samples_df.motion_score == 1.0].index
            self.samples_df.loc[assured_stop_idx, 'uncertain'] = False

        # Apply stop score algorithms
        unsure_ids = pd.DataFrame(self.samples_df[self.samples_df.uncertain].id)

        unsure_ids['range_start'] = unsure_ids.id.apply(lambda x: x - int(self.max_window_size / 2))
        unsure_ids['range_stop'] = unsure_ids.id.apply(lambda x: x + int(self.max_window_size / 2))
        ranges = unsure_ids.apply(
            lambda row: list(range(row.range_start, row.range_stop)),
            axis=1
        ).values
        relevant_ids_flat = np.array(list(ranges)).flatten()
        relevant_ids = np.unique(relevant_ids_flat)
        run_score_algorithms_idx = self.samples_df[self.samples_df.id.isin(relevant_ids)].index
        self.samples_df['run_scores'] = False
        self.samples_df.loc[run_score_algorithms_idx, 'run_scores'] = True

        run_scores = self.samples_df[self.samples_df.run_scores].set_index('key')
        score_results = pd.DataFrame()
        score_results['id'] = run_scores.id

        # Method 2: Rectangle distance ratio
        if self.settings['USE_METHOD_RDR']:
            score_results['rec_dist_score'] = run_scores.distance_to_next.rolling(
                self.settings['METHOD_RECTANGLE_DISTANCE_WINDOW_SIZE'],
                min_periods=self.settings['METHOD_RECTANGLE_DISTANCE_WINDOW_SIZE'],
                center=True
            ).apply(self.rectangle_path_distance_analysis)
        else:
            score_results['rec_dist_score'] = np.nan

        # Method 3: Bearing analysis
        if self.settings['USE_METHOD_BA']:
            score_results['bearing_score'] = run_scores.bearing.rolling(
                self.settings['METHOD_BEARING_ANALYSIS_WINDOW_SIZE'],
                min_periods=(self.settings['METHOD_BEARING_ANALYSIS_WINDOW_SIZE'] - 1),
                center=True
            ).apply(self.bearing_analysis)
        else:
            score_results['bearing_score'] = np.nan

        # Method 4: Start-end distance analysis
        if self.settings['USE_METHOD_SEDA']:
            score_results['start_end_distance_score'] = run_scores.distance_to_next.rolling(
                self.settings['METHOD_START_END_DISTANCE_ANALYSIS_WINDOW_SIZE'],
                min_periods=self.settings['METHOD_START_END_DISTANCE_ANALYSIS_WINDOW_SIZE'],
                center=True
            ).apply(self.start_end_distance_analysis)
        else:
            score_results['start_end_distance_score'] = np.nan

        # Method 5: Intersecting segments analysis
        if self.settings['USE_METHOD_ISA']:
            score_results = score_results.reset_index()
            run_scores = run_scores.reset_index()
            score_results['intersecting_segments_score'] = self.intersecting_segments_analysis(run_scores)
        else:
            score_results['intersecting_segments_score'] = np.nan

        # Compute final score
        weights = [
            self.settings['METHOD_RECTANGLE_DISTANCE_RATIO_WEIGHT'],
            self.settings['METHOD_BEARING_ANALYSIS_WEIGHT'],
            self.settings['METHOD_START_END_DISTANCE_ANALYSIS_WEIGHT'],
            self.settings['METHOD_INTERSECTING_SEGMENTS_ANALYSIS_WEIGHT'],
        ]
        score_results['final_score'] = (
            score_results[['rec_dist_score', 'bearing_score', 'start_end_distance_score', 
                          'intersecting_segments_score']] * weights
        ).mean(axis=1) / np.mean(weights)

        # Filter and merge scores
        relevant_scores = score_results[score_results.id.isin(unsure_ids.id)]

        self.samples_df = self.samples_df.set_index('id')
        relevant_scores = relevant_scores.set_index('id')
        self.samples_df['rec_dist_score'] = relevant_scores.rec_dist_score
        self.samples_df['bearing_score'] = relevant_scores.bearing_score
        self.samples_df['start_end_distance_score'] = relevant_scores.start_end_distance_score
        self.samples_df['intersecting_segments_score'] = relevant_scores.intersecting_segments_score
        self.samples_df['score_algorithms'] = relevant_scores.final_score

        # Method 6: Missing data analysis
        if self.settings['USE_METHOD_MDA']:
            uncertain_subset = self.samples_df[self.samples_df.uncertain].copy()
            uncertain_subset = StopGoClassifier.add_attributes(uncertain_subset, time=True, speed=True)
            stop_candidates = uncertain_subset[
                uncertain_subset.time_diff_to_next >= self.settings['MIN_MISSING_DATA_INTERVAL']
            ]
            if stop_candidates.shape[0] > 0:
                self.samples_df['missing_data_stop_score'] = stop_candidates.apply(
                    self.missing_data_analysis, axis=1
                )
            else:
                self.samples_df['missing_data_stop_score'] = np.nan
        else:
            self.samples_df['missing_data_stop_score'] = np.nan

        # Finalize
        self.samples_df = self.conclude(self.samples_df)
        self.samples_df = self.samples_df.reset_index().set_index('index')
        self.samples_df = self.samples_df[[
            'ts', 'x', 'y', 'rec_dist_score', 'bearing_score', 
            'start_end_distance_score', 'intersecting_segments_score', 
            'overall_score', 'is_stop', 'confidence'
        ]].dropna(subset=['overall_score'])

    def aggregate(self):
        """Aggregate classified samples into stop and trip intervals."""
        self.samples_df['decision_shifted'] = self.samples_df.is_stop.shift(1)
        self.samples_df.loc[self.samples_df.iloc[0].name, 'decision_shifted'] = self.samples_df.iloc[0].is_stop
        changes = self.samples_df[self.samples_df.decision_shifted != self.samples_df.is_stop].copy()

        if changes.shape[0] == 0:
            if self.samples_df.iloc[0].is_stop:
                result_stop = {
                    'start': self.samples_df.iloc[0].ts,
                    'stop': self.samples_df.iloc[-1].ts
                }
                final_stop_df = pd.DataFrame(result_stop, index=[0])
                self.stop_df = self.add_duration_and_average_position(final_stop_df)
            else:
                self.stop_df = pd.DataFrame(columns=['start', 'stop', 'duration', 'x', 'y'])
        else:
            def interpret_shift(row):
                if row.is_stop and not row.decision_shifted:
                    return 'start'
                else:
                    return 'stop'
            
            changes['stop_state'] = changes.apply(interpret_shift, axis=1)
            change_timestamps = list(changes[['ts', 'stop_state']].values)
            
            if change_timestamps[0][1] == 'stop':
                change_timestamps = [np.array([self.samples_df.iloc[0].ts, 'start'])] + change_timestamps
            if change_timestamps[-1][1] == 'start':
                change_timestamps = change_timestamps + [np.array([self.samples_df.iloc[-1].ts, 'stop'])]
            
            changes = pd.DataFrame(change_timestamps, columns=['ts', 'stop_state'])
            changes['stop_index'] = (np.arange(0, changes.shape[0]) / 2).astype(int)
            changes = changes.pivot(index='stop_index', columns='stop_state', values='ts')
            
            self.stop_df = self.add_duration_and_average_position(changes)
        
        self.samples_df = self.samples_df.drop(['decision_shifted'], axis=1)

    def filter_outliers(self):
        """Filter and merge stop outliers based on duration and proximity."""
        assert self.stop_df.shape[0] > 0, 'Filtering requires at least one identified stop'

        initial_stop_count = self.stop_df.shape[0]
        stop_attributed = StopGoClassifier.add_attributes(
            self.stop_df, dist=True, dist_prev=True, time_to_next=True, time_to_prev=True
        ).reset_index()
        self.overwrite_distance_with_path_length(stop_attributed)

        def stop_duration_score(row):
            value = row.duration
            if value == self.settings['MIN_STOP_INTERVAL']:
                value = self.settings['MIN_STOP_INTERVAL'] + 0.1
            return StopGoClassifier.compute_score(
                value,
                self.settings['MIN_STOP_INTERVAL'],
                self.settings['RELEVANT_STOP_DURATION']
            )

        def independence_score(row):
            if stop_attributed.shape[0] == 1:
                return 1.0

            if pd.isna(row.time_to_prev):
                time_value = row.time_to_next
            elif pd.isna(row.time_to_next):
                time_value = row.time_to_prev
            else:
                time_value = min(row.time_to_prev, row.time_to_next)

            if time_value > self.settings['MAX_TIME_BETWEEN_STOPS_FOR_MERGE']:
                time_score = 3.0
            else:
                time_score = StopGoClassifier.compute_score(
                    time_value,
                    self.settings['MIN_TIME_BETWEEN_STOPS'],
                    self.settings['RELEVANT_TIME_BETWEEN_STOPS']
                )

            if pd.isna(row.distance_to_prev):
                dist_value = row.distance_to_next
            elif pd.isna(row.distance_to_next):
                dist_value = row.distance_to_prev
            else:
                dist_value = min(row.distance_to_prev, row.distance_to_next)
            
            dist_score = StopGoClassifier.compute_score(
                dist_value,
                self.settings['MIN_DISTANCE_BETWEEN_STOP'],
                self.settings['RELEVANT_DISTANCE_BETWEEN_STOP']
            )

            if (time_score == 1.0) and (dist_score == -1):
                return -0.001
            return np.mean([time_score, dist_score])

        def conclude_merge(row):
            if (row.stop_duration_score == -1.0) and (row.independence_score >= 0.0):
                return 'delete'
            elif row.independence_score < 0.0:
                return 'merge'
            else:
                return 'keep'

        def merge_direction(row):
            if row.merge_decision != 'merge':
                return np.nan

            if row.next_merge_decision != 'delete':
                if pd.isna(row.distance_to_prev) or (
                    (min(row.distance_to_prev, row.distance_to_next) == row.distance_to_next) and 
                    (row.time_to_next <= self.settings['MAX_TIME_BETWEEN_STOPS_FOR_MERGE'])
                ):
                    return 1

            if row.prev_merge_decision != 'delete':
                if not pd.isna(row.distance_to_prev) and (
                    (min(row.distance_to_prev, row.distance_to_next) == row.distance_to_prev) and 
                    (row.time_to_prev <= self.settings['MAX_TIME_BETWEEN_STOPS_FOR_MERGE'])
                ):
                    return -1

            return np.nan

        stop_attributed['stop_duration_score'] = stop_attributed.apply(stop_duration_score, axis=1)
        stop_attributed['independence_score'] = stop_attributed.apply(independence_score, axis=1)
        stop_attributed['merge_decision'] = stop_attributed.apply(conclude_merge, axis=1)
        stop_attributed['next_merge_decision'] = stop_attributed.merge_decision.shift(-1)
        stop_attributed['prev_merge_decision'] = stop_attributed.merge_decision.shift(1)
        stop_attributed['merge_direction'] = stop_attributed.apply(merge_direction, axis=1)
        
        if self.debug_stop_merge_df is None:
            self.debug_stop_merge_df = stop_attributed.copy()

        stop_attributed = stop_attributed[
            (stop_attributed.merge_decision != 'delete') & 
            ~((stop_attributed.merge_decision == 'merge') & pd.isna(stop_attributed.merge_direction))
        ].copy()

        if (stop_attributed.shape[0] == 0) or (
            (stop_attributed.shape[0] == 1) and 
            (stop_attributed.iloc[0].stop_duration_score == -1)
        ):
            final_stop_df = StopGoClassifier.empty_stops_df()
        elif stop_attributed.shape[0] == 1:
            final_stop_df = stop_attributed[['start', 'stop']].copy()
        else:
            stop_attributed['id'] = range(stop_attributed.shape[0])
            stop_attributed = stop_attributed.set_index('id')
            stop_attributed['merged'] = False
            merger_ids = stop_attributed[stop_attributed.merge_decision == 'merge'].index.values

            for index in merger_ids:
                merger = stop_attributed.loc[index]
                neighbour_index = index + merger.merge_direction
                closest_neighbour = stop_attributed.loc[neighbour_index]

                if closest_neighbour.merged:
                    continue

                stop_attributed.loc[neighbour_index, 'start'] = min(closest_neighbour.start, merger.start)
                stop_attributed.loc[neighbour_index, 'stop'] = max(closest_neighbour.stop, merger.stop)
                stop_attributed.loc[index, 'merged'] = True

            remaining_stops = stop_attributed[stop_attributed.merged == False]
            final_stop_df = remaining_stops[['start', 'stop']].copy()

        final_stop_df.reset_index(drop=True, inplace=True)
        final_stop_df.columns.name = 'id'
        self.stop_df = self.add_duration_and_average_position(final_stop_df)

        if (initial_stop_count != self.stop_df.shape[0]) and (self.stop_df.shape[0] > 0):
            self.filter_outliers()

    def isolate_trip_samples(self):
        """Isolate GPS samples that belong to trip intervals."""
        if len(self.stop_df) == 0:
            self.trip_df = pd.DataFrame(
                [[self.samples_df.ts.iloc[0], self.samples_df.ts.iloc[-1]]],
                columns=['start', 'stop']
            )
            self.trip_samples_df = self.samples_df
            return

        trips = pd.DataFrame(columns=['start', 'stop'])

        if len(self.stop_df) >= 2:
            trips = self.stop_df[['start', 'stop']].copy()
            trips.start = trips.stop
            trips.stop = self.stop_df.start.shift(-1)
            trips = trips.iloc[:-1]

        if self.samples_df.iloc[0].ts < self.stop_df.iloc[0].start:
            trips.loc[len(trips)] = {
                'start': self.samples_df.iloc[0].ts,
                'stop': self.stop_df.iloc[0].start
            }
        if self.samples_df.iloc[-1].ts > self.stop_df.iloc[-1].stop:
            trips.loc[len(trips)] = {
                'start': self.stop_df.iloc[-1].stop,
                'stop': self.samples_df.iloc[-1].ts
            }

        self.trip_df = trips.sort_values('start').reset_index()[['start', 'stop']]
        if len(self.trip_df) > 0:
            self.trip_df['duration'] = trips.apply(
                lambda row: (row.stop - row.start).total_seconds(), axis=1
            )
        else:
            self.trip_df = pd.DataFrame(columns=['start', 'stop', 'duration'])

        self.trip_samples_df = pd.DataFrame()
        for _, trip in trips.iterrows():
            self.trip_samples_df = pd.concat([
                self.trip_samples_df,
                self.samples_df[(self.samples_df.ts >= trip.start) & (self.samples_df.ts <= trip.stop)]
            ])

    # ==========================================================================
    # Stop Score Algorithms
    # ==========================================================================

    def rectangle_path_distance_analysis(self, window):
        """Method 2: Analyze rectangle path distance ratio."""
        points = np.array(list(window.index.values))

        try:
            convexhull = spatial.ConvexHull(points)
            convhull_vertices = points[convexhull.vertices]
            dist_mat = spatial.distance_matrix(convhull_vertices, convhull_vertices)
            idx_p1, idx_p2 = np.unravel_index(dist_mat.argmax(), dist_mat.shape)
            x1, y1 = convhull_vertices[idx_p1]
            x2, y2 = convhull_vertices[idx_p2]
        except spatial.QhullError:
            x1, y1 = points[0]
            x2, y2 = points[-1]

        max_distance_between_points = np.sqrt(np.square(x1 - x2) + np.square(y1 - y2))
        cummulative_distance = window.values.sum()
        rectangle_distance_ratio = cummulative_distance / max_distance_between_points

        return StopGoClassifier.compute_score(
            rectangle_distance_ratio,
            1.0,
            self.settings['METHOD_RECTANGLE_DISTANCE_RATIO_UPPER_CUTOFF'],
            self.settings['METHOD_RECTANGLE_DISTANCE_RATIO_THRESHOLD']
        )

    def bearing_analysis(self, window):
        """Method 3: Analyze bearing changes."""
        sorted_slice = np.sort(window)[1:-1]
        mean_abs_angle_diff = np.mean(sorted_slice)

        return StopGoClassifier.compute_score(
            mean_abs_angle_diff,
            self.settings['METHOD_BEARING_ANALYSIS_LOWER_CUTOFF'],
            self.settings['METHOD_BEARING_ANALYSIS_UPPER_CUTOFF'],
            self.settings['METHOD_BEARING_ANALYSIS_THRESHOLD']
        )

    def start_end_distance_analysis(self, window):
        """Method 4: Analyze distance between path start and end."""
        xs = np.array(list(map(lambda x: x[0], window.index.values)))
        ys = np.array(list(map(lambda x: x[1], window.index.values)))

        start_x = xs[:2].mean()
        start_y = ys[:2].mean()
        end_x = xs[-2:].mean()
        end_y = ys[-2:].mean()

        distance = np.sqrt(np.square(start_x - end_x) + np.square(start_y - end_y))

        score = StopGoClassifier.compute_score(
            distance,
            self.settings['METHOD_START_END_DISTANCE_ANALYSIS_LOWER_CUTOFF'],
            self.settings['METHOD_START_END_DISTANCE_ANALYSIS_UPPER_CUTOFF'],
            self.settings['METHOD_START_END_DISTANCE_ANALYSIS_THRESHOLD']
        )
        return score * -1

    def intersecting_segments_analysis(self, samples_df):
        """Method 5: Analyze intersecting path segments."""
        segments = np.array([
            samples_df.x.values[:-1],
            samples_df.y.values[:-1],
            samples_df.x.values[1:],
            samples_df.y.values[1:],
        ])

        row_count = len(samples_df) - 1
        intersection_matrix = np.zeros((row_count, row_count))
        
        for row_idx in range(row_count):
            for col_idx in range(
                row_idx + 2,
                min(row_idx + self.settings['METHOD_INTERSECTING_SEGMENTS_ANALYSIS_WINDOW_SIZE'], row_count)
            ):
                ax, ay = segments[0, row_idx], segments[1, row_idx]
                bx, by = segments[2, row_idx], segments[3, row_idx]
                cx, cy = segments[0, col_idx], segments[1, col_idx]
                dx, dy = segments[2, col_idx], segments[3, col_idx]
                intersection_matrix[row_idx, col_idx] = StopGoClassifier.intersect(
                    ax, ay, bx, by, cx, cy, dx, dy
                )

        def count_intersections(window):
            a, b = window.index[0], window.index[-1]
            intersections = intersection_matrix[a:b, a:b].sum()
            return StopGoClassifier.compute_score(
                intersections,
                0,
                self.settings['METHOD_INTERSECTING_SEGMENTS_ANALYSIS_UPPER_CUTOFF'],
                self.settings['METHOD_INTERSECTING_SEGMENTS_ANALYSIS_THRESHOLD']
            )

        scores = samples_df.x.rolling(
            self.settings['METHOD_INTERSECTING_SEGMENTS_ANALYSIS_WINDOW_SIZE'],
            min_periods=self.settings['METHOD_INTERSECTING_SEGMENTS_ANALYSIS_WINDOW_SIZE'],
            center=True
        ).apply(count_intersections)
        
        return scores

    def missing_data_analysis(self, row):
        """Method 6: Analyze data gaps to detect stops."""
        speed = row.speed * 3.6  # km/h

        score = StopGoClassifier.compute_score(
            speed,
            self.settings['METHOD_MISSING_DATA_ANALYSIS_LOWER_CUTOFF'],
            self.settings['METHOD_MISSING_DATA_ANALYSIS_UPPER_CUTOFF'],
            self.settings['METHOD_MISSING_DATA_ANALYSIS_THRESHOLD']
        )
        return score * -1

    # ==========================================================================
    # Helper Methods
    # ==========================================================================

    def compute_motion_score(self, row):
        """Compute motion score from accelerometer data."""
        limited = min(
            self.settings['MOTION_SCORE_UPPER_CUTOFF'],
            max(self.settings['MOTION_SCORE_LOWER_CUTOFF'], row.motion_score)
        )
        shifted = limited - self.settings['MOTION_SCORE_THRESHOLD']

        if shifted < 0:
            return (1 / (self.settings['MOTION_SCORE_THRESHOLD'] - 
                        self.settings['MOTION_SCORE_LOWER_CUTOFF'])) * shifted * -1
        else:
            return (1 / (self.settings['MOTION_SCORE_UPPER_CUTOFF'] - 
                        self.settings['MOTION_SCORE_THRESHOLD'])) * shifted * -1

    def find_stop_center_from_timestamps(self, row):
        """Find the center position of a stop from its timestamps."""
        if pd.isna(row.start):
            relevant_samples = self.samples_df[self.samples_df.ts <= row.stop]
        elif pd.isna(row.stop):
            relevant_samples = self.samples_df[self.samples_df.ts >= row.start]
        else:
            relevant_samples = self.samples_df[
                (self.samples_df.ts >= row.start) & (self.samples_df.ts <= row.stop)
            ]

        x = relevant_samples.x.median()
        y = relevant_samples.y.median()
        return (x, y)

    def add_duration_and_average_position(self, df):
        """Add duration and average position to stop DataFrame."""
        if df.shape[0] > 0:
            df['duration'] = df.apply(lambda row: (row.stop - row.start).total_seconds(), axis=1)
            stop_centers = df.apply(self.find_stop_center_from_timestamps, axis=1)
            df['x'] = stop_centers.apply(lambda x: x[0])
            df['y'] = stop_centers.apply(lambda x: x[1])
        return df

    def overwrite_distance_with_path_length(self, df):
        """Overwrite Euclidean distance with actual path length."""
        df['next_start'] = df.start.shift(-1)
        df['path_length_to_next'] = df.apply(
            lambda row: StopGoClassifier.path_length_between(self.samples_df, row.stop, row.next_start),
            axis=1
        )
        df['path_length_to_prev'] = df.path_length_to_next.shift(1)
        df['distance_to_next'] = df.apply(
            lambda row: max(row.distance_to_next, row.path_length_to_next), axis=1
        )
        df['distance_to_prev'] = df.apply(
            lambda row: max(row.distance_to_prev, row.path_length_to_prev), axis=1
        )

    def conclude(self, df):
        """Conclude stop/trip classification for each sample."""
        def select_score(row):
            if row.uncertain:
                if not self.settings['USE_METHOD_MDA'] or pd.isna(row.missing_data_stop_score):
                    return row.score_algorithms
                else:
                    return row.missing_data_stop_score
            return row.motion_score

        def overwrite_rolling_average(row):
            if row.missing_data_stop_score > 0:
                return row.missing_data_stop_score
            elif pd.isna(row.overall_score):
                return row.score_algorithms
            return row.overall_score

        df['overall_score'] = df.apply(select_score, axis=1)
        smoothing_window_size = 5
        df.overall_score = df.overall_score.rolling(
            smoothing_window_size,
            min_periods=smoothing_window_size,
            center=True
        ).mean()
        df.overall_score = df.apply(overwrite_rolling_average, axis=1)
        df['is_stop'] = df.overall_score > 0
        df['confidence'] = df.overall_score.abs()
        return df

    # ==========================================================================
    # Static Methods
    # ==========================================================================

    @staticmethod
    def bearing_deviation(ax, ay, bx, by, cx, cy):
        """Calculate bearing deviation between three points."""
        if np.isnan(ax) or np.isnan(cx):
            return np.nan

        a = np.array([ax, ay])
        b = np.array([bx, by])
        c = np.array([cx, cy])

        ba = a - b
        bc = c - b

        cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
        cosine_angle = max(-1, min(1, cosine_angle))

        difference_deg = np.rad2deg(np.arccos(cosine_angle) - np.pi)
        return np.abs(difference_deg)

    @staticmethod
    def add_attributes(df, dist=False, dist_prev=False, time=False, speed=False, 
                       bearing=False, time_to_next=False, time_to_prev=False):
        """Add computed attributes to DataFrame."""
        if speed or dist or bearing:
            df['next_x'] = df.x.shift(-1)
            df['next_y'] = df.y.shift(-1)
            df['distance_to_next'] = np.sqrt(
                np.square(df.x - df.next_x) + np.square(df.y - df.next_y)
            )

        if dist_prev or bearing:
            df['prev_x'] = df.x.shift(1)
            df['prev_y'] = df.y.shift(1)
            df['distance_to_prev'] = np.sqrt(
                np.square(df.x - df.prev_x) + np.square(df.y - df.prev_y)
            )

        if speed or time:
            df['next_ts'] = df.ts.shift(-1)
            df['time_diff_to_next'] = df.apply(
                lambda row: (row.next_ts - row.ts).total_seconds(), axis=1
            )

        if speed:
            def compute_speed(row):
                if row.time_diff_to_next > 0:
                    return row.distance_to_next / row.time_diff_to_next
                return np.nan
            df['speed'] = df.apply(compute_speed, axis=1)

        if bearing:
            df['bearing'] = df.apply(
                lambda row: StopGoClassifier.bearing_deviation(
                    row.prev_x, row.prev_y, row.x, row.y, row.next_x, row.next_y
                ),
                axis=1
            )

        if time_to_next:
            df['next_start'] = df.start.shift(-1)
            df['time_to_next'] = df.apply(
                lambda row: (row.next_start - row.stop).total_seconds(), axis=1
            )

        if time_to_prev:
            df['prev_stop'] = df.stop.shift(1)
            df['time_to_prev'] = df.apply(
                lambda row: (row.start - row.prev_stop).total_seconds(), axis=1
            )

        return df

    @staticmethod
    def path_length_between(df, start, stop):
        """Calculate path length between two timestamps."""
        samples_between = df[(df.ts >= start) & (df.ts <= stop)].copy()
        if len(samples_between) < 2:
            return np.nan

        StopGoClassifier.add_attributes(samples_between, dist=True)
        return samples_between.distance_to_next.sum()

    @staticmethod
    def intersect(ax, ay, bx, by, cx, cy, dx, dy):
        """Check if two line segments intersect."""
        def ccw(ax, ay, bx, by, cx, cy):
            return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax)

        return (ccw(ax, ay, cx, cy, dx, dy) != ccw(bx, by, cx, cy, dx, dy) and 
                ccw(ax, ay, bx, by, cx, cy) != ccw(ax, ay, bx, by, dx, dy))

    @staticmethod
    def compute_score(value, lower_cutoff, upper_cutoff, threshold=None):
        """Compute normalized score in range [-1, 1]."""
        if pd.isna(value):
            return np.nan
        if threshold is None:
            threshold = np.mean([lower_cutoff, upper_cutoff])

        shifted = min(upper_cutoff, max(lower_cutoff, value)) - threshold
        if shifted < 0:
            return (1 / (threshold - lower_cutoff)) * shifted
        return (1 / (upper_cutoff - threshold)) * shifted

    @staticmethod
    def empty_stops_df():
        """Return empty stops DataFrame."""
        return pd.DataFrame(columns=['start', 'stop', 'duration', 'x', 'y'])
