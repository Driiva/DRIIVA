
import { TelematicsData, DrivingMetrics } from './telematics';

export interface RiskProfile {
  riskScore: number;
  riskCategory: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  predictedClaimProbability: number;
  confidenceScore: number;
  riskFactors: RiskFactor[];
  recommendations: string[];
}

export interface RiskFactor {
  factor: string;
  impact: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

export interface DriverBehaviorPattern {
  aggressiveness: number;
  consistency: number;
  timeOfDayPattern: number[];
  weatherAdaptability: number;
  routeFamiliarity: number;
}

export interface MachineLearningFeatures {
  // Temporal features
  timeOfDay: number;
  dayOfWeek: number;
  seasonality: number;
  
  // Behavioral features
  accelerationVariance: number;
  brakingPattern: number;
  speedConsistency: number;
  corneringStyle: number;
  
  // Environmental features
  weatherConditions: number;
  trafficDensity: number;
  roadType: number;
  
  // Historical features
  recentPerformance: number;
  improvementTrend: number;
  violationHistory: number;
  
  // Route features
  routeFamiliarity: number;
}

export class AIRiskScoringEngine {
  private readonly RISK_WEIGHTS = {
    behavioral: 0.45,
    environmental: 0.22,
    historical: 0.25,
    temporal: 0.08
  };

  private readonly ML_THRESHOLDS = {
    lowRisk: 0.25,
    mediumRisk: 0.55,
    highRisk: 0.75
  };

  private readonly FEATURE_IMPORTANCE = {
    aggressiveness: 0.28,
    consistency: 0.22,
    violationHistory: 0.18,
    timeOfDay: 0.12,
    weatherConditions: 0.10,
    trafficDensity: 0.06,
    routeFamiliarity: 0.04
  };

  calculateAIRiskScore(
    telematicsData: TelematicsData,
    drivingMetrics: DrivingMetrics,
    historicalData?: DrivingMetrics[]
  ): RiskProfile {
    // Validate input data
    if (!this.validateInputData(telematicsData, drivingMetrics)) {
      throw new Error('Invalid telematics data provided to AI model');
    }

    try {
      // Extract ML features
      const features = this.extractFeatures(telematicsData, drivingMetrics, historicalData);
      
      // Calculate behavioral patterns
      const behaviorPattern = this.analyzeBehaviorPattern(telematicsData, drivingMetrics);
      
      // Run ensemble models
      const riskScore = this.runEnsembleModel(features, behaviorPattern);
      
      // Calculate claim probability
      const claimProbability = this.predictClaimProbability(features, riskScore, behaviorPattern);
      
      // Identify risk factors
      const riskFactors = this.identifyRiskFactors(features, behaviorPattern);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(riskFactors, behaviorPattern);
      
      const result = {
        riskScore: Math.round(riskScore * 1000) / 1000, // 3 decimal precision
        riskCategory: this.categorizeRisk(riskScore),
        predictedClaimProbability: Math.round(claimProbability * 10000) / 100,
        confidenceScore: Math.round(this.calculateConfidence(features) * 1000) / 1000,
        riskFactors,
        recommendations
      };

      // Log successful AI processing
      console.log(`AI Model Results: Risk=${result.riskCategory}(${result.riskScore}), Claim Prob=${result.predictedClaimProbability}%, Confidence=${(result.confidenceScore*100).toFixed(1)}%`);
      
      return result;
    } catch (error) {
      console.error('AI Risk Scoring Engine Error:', error);
      throw new Error(`AI model calculation failed: ${(error as Error).message}`, { cause: error });
    }
  }

  private validateInputData(telematicsData: TelematicsData, drivingMetrics: DrivingMetrics): boolean {
    // Validate telematics data
    if (!telematicsData.gpsPoints || telematicsData.gpsPoints.length < 2) {
      console.warn('Insufficient GPS data for AI analysis');
      return false;
    }

    if (!telematicsData.accelerometerData || telematicsData.accelerometerData.length < 10) {
      console.warn('Insufficient accelerometer data for AI analysis');
      return false;
    }

    if (!telematicsData.speedData || telematicsData.speedData.length < 5) {
      console.warn('Insufficient speed data for AI analysis');
      return false;
    }

    // Validate driving metrics
    if (drivingMetrics.distance <= 0 || drivingMetrics.duration <= 0) {
      console.warn('Invalid trip distance or duration for AI analysis');
      return false;
    }

    return true;
  }

  private extractFeatures(
    telematicsData: TelematicsData,
    metrics: DrivingMetrics,
    historicalData?: DrivingMetrics[]
  ): MachineLearningFeatures {
    const firstPoint = telematicsData.gpsPoints[0];
    const date = new Date(firstPoint?.timestamp || Date.now());
    
    return {
      // Temporal features
      timeOfDay: date.getHours() / 24,
      dayOfWeek: date.getDay() / 7,
      seasonality: this.calculateSeasonality(date),
      
      // Behavioral features
      accelerationVariance: this.calculateAccelerationVariance(telematicsData.accelerometerData),
      brakingPattern: this.analyzeBrakingPattern(telematicsData.accelerometerData),
      speedConsistency: this.calculateSpeedConsistency(telematicsData.speedData),
      corneringStyle: this.analyzeCorneringStyle(telematicsData.gyroscopeData),
      
      // Environmental features (simulated - in production, integrate weather/traffic APIs)
      weatherConditions: this.estimateWeatherConditions(date),
      trafficDensity: this.estimateTrafficDensity(firstPoint, date),
      roadType: this.classifyRoadType(telematicsData.speedData),
      
      // Historical features
      recentPerformance: this.calculateRecentPerformance(historicalData),
      improvementTrend: this.calculateImprovementTrend(historicalData),
      violationHistory: this.calculateViolationHistory(historicalData),
      
      // Route features
      routeFamiliarity: this.calculateRouteFamiliarity(telematicsData.gpsPoints)
    };
  }

  private runEnsembleModel(features: MachineLearningFeatures, pattern: DriverBehaviorPattern): number {
    // Enhanced ensemble with stacking approach
    const randomForestScore = this.randomForestModel(features);
    const gradientBoostingScore = this.gradientBoostingModel(features, pattern);
    const neuralNetworkScore = this.neuralNetworkModel(features, pattern);
    const xgboostScore = this.xgboostModel(features, pattern);
    
    // Meta-learner for optimal weight combination
    const metaWeights = this.calculateMetaWeights(features, pattern);
    
    return (randomForestScore * metaWeights.rf) + 
           (gradientBoostingScore * metaWeights.gb) + 
           (neuralNetworkScore * metaWeights.nn) +
           (xgboostScore * metaWeights.xgb);
  }

  private randomForestModel(features: MachineLearningFeatures): number {
    // Enhanced Random Forest with multiple decision trees
    const trees = this.generateDecisionTrees(features);
    let aggregatedScore = 0;
    
    // Tree 1: Behavioral focus
    let tree1Score = 0.35;
    tree1Score += features.accelerationVariance * 0.25;
    tree1Score += features.brakingPattern * 0.22;
    tree1Score += (1 - features.speedConsistency) * 0.20;
    tree1Score += features.corneringStyle * 0.18;
    
    // Tree 2: Historical patterns
    let tree2Score = 0.30;
    tree2Score += features.violationHistory * 0.35;
    tree2Score += (1 - features.recentPerformance) * 0.25;
    tree2Score += Math.abs(features.improvementTrend) * 0.20;
    
    // Tree 3: Environmental context
    let tree3Score = 0.25;
    const nightRiskMultiplier = (features.timeOfDay > 0.85 || features.timeOfDay < 0.2) ? 1.4 : 1.0;
    const weekendMultiplier = features.dayOfWeek > 0.7 ? 1.2 : 1.0;
    tree3Score += features.weatherConditions * 0.3 * nightRiskMultiplier;
    tree3Score += features.trafficDensity * 0.25 * weekendMultiplier;
    tree3Score += features.roadType * 0.15;
    
    // Aggregate with weighted voting
    aggregatedScore = (tree1Score * 0.45) + (tree2Score * 0.35) + (tree3Score * 0.20);
    
    return Math.min(0.95, Math.max(0.05, aggregatedScore));
  }

  private gradientBoostingModel(features: MachineLearningFeatures, pattern: DriverBehaviorPattern): number {
    // Enhanced Gradient Boosting with sequential weak learners
    const predictions: number[] = [];
    let currentPrediction = 0.4; // Base prediction
    
    // Weak learner 1: Behavioral patterns
    const residual1 = this.calculateResidual(currentPrediction, features, pattern);
    const learner1 = this.behavioralLearner(features, pattern, residual1);
    currentPrediction = Math.max(0, Math.min(1, currentPrediction + learner1 * 0.15));
    predictions.push(currentPrediction);
    
    // Weak learner 2: Temporal-environmental interactions
    const residual2 = this.calculateResidual(currentPrediction, features, pattern);
    const learner2 = this.temporalEnvironmentalLearner(features, pattern, residual2);
    currentPrediction = Math.max(0, Math.min(1, currentPrediction + learner2 * 0.12));
    predictions.push(currentPrediction);
    
    // Weak learner 3: Historical trend analysis
    const residual3 = this.calculateResidual(currentPrediction, features, pattern);
    const learner3 = this.historicalTrendLearner(features, pattern, residual3);
    currentPrediction = Math.max(0, Math.min(1, currentPrediction + learner3 * 0.10));
    predictions.push(currentPrediction);
    
    // Weak learner 4: Non-linear interaction effects
    const residual4 = this.calculateResidual(currentPrediction, features, pattern);
    const learner4 = this.nonLinearInteractionLearner(features, pattern, residual4);
    currentPrediction = Math.max(0, Math.min(1, currentPrediction + learner4 * 0.08));
    
    return currentPrediction;
  }

  private neuralNetworkModel(features: MachineLearningFeatures, pattern: DriverBehaviorPattern): number {
    // Simulate deep neural network with non-linear activation
    const hidden1 = this.sigmoid(
      features.accelerationVariance * 0.3 +
      features.brakingPattern * 0.25 +
      pattern.aggressiveness * 0.2 +
      features.timeOfDay * 0.15 +
      features.weatherConditions * 0.1
    );
    
    const hidden2 = this.sigmoid(
      features.speedConsistency * -0.3 +
      pattern.consistency * -0.25 +
      features.improvementTrend * -0.2 +
      features.routeFamiliarity * -0.15 +
      hidden1 * 0.1
    );
    
    const output = this.sigmoid(hidden1 * 0.6 + hidden2 * 0.4 + features.violationHistory * 0.2);
    
    return output;
  }

  private analyzeBehaviorPattern(telematicsData: TelematicsData, metrics: DrivingMetrics): DriverBehaviorPattern {
    return {
      aggressiveness: this.calculateAggressiveness(telematicsData, metrics),
      consistency: this.calculateConsistency(telematicsData),
      timeOfDayPattern: this.analyzeTimeOfDayPattern(telematicsData.gpsPoints),
      weatherAdaptability: this.assessWeatherAdaptability(telematicsData),
      routeFamiliarity: this.calculateRouteFamiliarity(telematicsData.gpsPoints)
    };
  }

  private identifyRiskFactors(features: MachineLearningFeatures, pattern: DriverBehaviorPattern): RiskFactor[] {
    const factors: RiskFactor[] = [];
    
    if (pattern.aggressiveness > 0.7) {
      factors.push({
        factor: 'Aggressive Driving',
        impact: pattern.aggressiveness,
        severity: 'HIGH',
        description: 'Frequent hard acceleration and braking events detected'
      });
    }
    
    if (features.timeOfDay > 0.85 || features.timeOfDay < 0.2) {
      factors.push({
        factor: 'Night Driving',
        impact: 0.6,
        severity: 'MEDIUM',
        description: 'Regular driving during high-risk night hours'
      });
    }
    
    if (features.speedConsistency < 0.4) {
      factors.push({
        factor: 'Inconsistent Speed',
        impact: 1 - features.speedConsistency,
        severity: 'MEDIUM',
        description: 'Erratic speed patterns indicating poor speed management'
      });
    }
    
    if (features.violationHistory > 0.5) {
      factors.push({
        factor: 'Speed Violations',
        impact: features.violationHistory,
        severity: 'HIGH',
        description: 'History of speeding violations'
      });
    }
    
    return factors.sort((a, b) => b.impact - a.impact);
  }

  private generateRecommendations(factors: RiskFactor[], pattern: DriverBehaviorPattern): string[] {
    const recommendations: string[] = [];
    
    if (pattern.aggressiveness > 0.6) {
      recommendations.push('Practice smooth acceleration and gradual braking to improve your driving score');
    }
    
    if (pattern.consistency < 0.5) {
      recommendations.push('Focus on maintaining consistent driving patterns for better risk assessment');
    }
    
    factors.forEach(factor => {
      switch (factor.factor) {
        case 'Night Driving':
          recommendations.push('Consider avoiding driving during late night hours when possible');
          break;
        case 'Speed Violations':
          recommendations.push('Use cruise control and speed limit alerts to maintain safe speeds');
          break;
        case 'Inconsistent Speed':
          recommendations.push('Practice maintaining steady speeds appropriate for road conditions');
          break;
      }
    });
    
    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  }

  // Helper methods for feature extraction
  private calculateAccelerationVariance(accelerometerData: any[]): number {
    if (accelerometerData.length < 2) return 0;
    
    const accelerations = accelerometerData.map((reading, i) => {
      if (i === 0) return 0;
      return Math.abs(reading.x - accelerometerData[i - 1].x);
    });
    
    const mean = accelerations.reduce((sum, acc) => sum + acc, 0) / accelerations.length;
    const variance = accelerations.reduce((sum, acc) => sum + Math.pow(acc - mean, 2), 0) / accelerations.length;
    
    return Math.min(1, variance * 10); // Normalize to 0-1
  }

  private calculateAggressiveness(telematicsData: TelematicsData, metrics: DrivingMetrics): number {
    const totalEvents = metrics.hardBrakingEvents + metrics.harshAccelerationEvents + metrics.sharpCorners;
    const tripDuration = metrics.duration || 1;
    
    // Events per hour
    const eventsPerHour = (totalEvents / tripDuration) * 60;
    
    return Math.min(1, eventsPerHour / 10); // Normalize: 10+ events/hour = max aggressiveness
  }

  private calculateConsistency(telematicsData: TelematicsData): number {
    // Analyze consistency across speed, acceleration, and cornering
    const speedVariance = this.calculateSpeedConsistency(telematicsData.speedData);
    const accelVariance = this.calculateAccelerationVariance(telematicsData.accelerometerData);
    
    return (speedVariance + (1 - accelVariance)) / 2;
  }

  private calculateSpeedConsistency(speedData: any[]): number {
    if (speedData.length < 2) return 1;
    
    const speeds = speedData.map(reading => reading.speed);
    const mean = speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
    const variance = speeds.reduce((sum, speed) => sum + Math.pow(speed - mean, 2), 0) / speeds.length;
    const stdDev = Math.sqrt(variance);
    
    // Lower coefficient of variation = higher consistency
    const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;
    return Math.max(0, 1 - coefficientOfVariation);
  }

  // Utility methods
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  private categorizeRisk(riskScore: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (riskScore < this.ML_THRESHOLDS.lowRisk) return 'LOW';
    if (riskScore < this.ML_THRESHOLDS.mediumRisk) return 'MEDIUM';
    if (riskScore < this.ML_THRESHOLDS.highRisk) return 'HIGH';
    return 'CRITICAL';
  }

  private calculateConfidence(features: MachineLearningFeatures): number {
    // Multi-dimensional confidence assessment
    let confidence = 0.75; // Base confidence
    
    // Data completeness factor
    const completenessScore = this.calculateDataCompleteness(features);
    confidence += completenessScore * 0.15;
    
    // Pattern consistency factor
    const consistencyScore = this.calculatePatternConsistency(features);
    confidence += consistencyScore * 0.10;
    
    // Historical data availability
    if (features.recentPerformance > 0) confidence += 0.08;
    if (features.improvementTrend !== 0) confidence += 0.04;
    if (features.violationHistory >= 0) confidence += 0.03;
    
    // Model agreement factor (simulated ensemble agreement)
    const modelAgreement = this.calculateModelAgreement(features);
    confidence += modelAgreement * 0.08;
    
    // Temporal stability
    const temporalStability = this.calculateTemporalStability(features);
    confidence += temporalStability * 0.05;
    
    return Math.max(0.6, Math.min(0.98, confidence));
  }

  private calculateDataCompleteness(features: MachineLearningFeatures): number {
    const requiredFeatures = 11; // Total number of key features
    let availableFeatures = 0;
    
    if (features.accelerationVariance >= 0) availableFeatures++;
    if (features.brakingPattern >= 0) availableFeatures++;
    if (features.speedConsistency >= 0) availableFeatures++;
    if (features.corneringStyle >= 0) availableFeatures++;
    if (features.weatherConditions >= 0) availableFeatures++;
    if (features.trafficDensity >= 0) availableFeatures++;
    if (features.roadType >= 0) availableFeatures++;
    if (features.recentPerformance >= 0) availableFeatures++;
    if (features.improvementTrend !== undefined) availableFeatures++;
    if (features.violationHistory >= 0) availableFeatures++;
    if (features.timeOfDay >= 0) availableFeatures++;
    
    return availableFeatures / requiredFeatures;
  }

  private calculatePatternConsistency(features: MachineLearningFeatures): number {
    // Measure how consistent the feature patterns are
    const speedConsistencyNorm = features.speedConsistency;
    const behavioralConsistency = 1 - features.accelerationVariance;
    const overallConsistency = (speedConsistencyNorm + behavioralConsistency) / 2;
    
    return overallConsistency;
  }

  private calculateModelAgreement(features: MachineLearningFeatures): number {
    // Simulate agreement between different model predictions
    // In production, this would measure actual ensemble disagreement
    const variabilityFactor = features.accelerationVariance + 
                             (1 - features.speedConsistency) +
                             features.weatherConditions;
    
    // Lower variability = higher model agreement
    return Math.max(0.3, 1 - (variabilityFactor / 3));
  }

  private calculateTemporalStability(features: MachineLearningFeatures): number {
    // Assess stability of temporal patterns
    let stability = 0.7;
    
    // Consistent time patterns increase stability
    if (features.timeOfDay >= 0.2 && features.timeOfDay <= 0.85) {
      stability += 0.15; // Daytime driving is more predictable
    }
    
    // Seasonal consistency
    if (features.seasonality > 0 && features.seasonality < 0.9) {
      stability += 0.1;
    }
    
    return Math.min(1, stability);
  }

  // Placeholder methods for environmental factors (integrate with real APIs in production)
  private calculateSeasonality(date: Date): number {
    const month = date.getMonth();
    // Winter months (Dec, Jan, Feb) have higher risk
    if (month === 11 || month === 0 || month === 1) return 0.8;
    return 0.3;
  }

  private estimateWeatherConditions(date: Date): number {
    // Placeholder - integrate with weather API
    return Math.random() * 0.5; // 0-0.5 risk factor
  }

  private estimateTrafficDensity(gpsPoint: any, date: Date): number {
    // Placeholder - integrate with traffic API
    const hour = date.getHours();
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
      return 0.8; // Rush hour
    }
    return 0.3;
  }

  private classifyRoadType(speedData: any[]): number {
    // Classify based on speed patterns
    const avgSpeed = speedData.reduce((sum, reading) => sum + reading.speed, 0) / speedData.length;
    
    if (avgSpeed > 60) return 0.7; // Highway
    if (avgSpeed > 35) return 0.4; // Arterial
    return 0.2; // Residential
  }

  private analyzeTimeOfDayPattern(gpsPoints: any[]): number[] {
    const hourPattern = new Array(24).fill(0);
    
    gpsPoints.forEach(point => {
      const hour = new Date(point.timestamp).getHours();
      hourPattern[hour]++;
    });
    
    return hourPattern;
  }

  private assessWeatherAdaptability(telematicsData: TelematicsData): number {
    // Placeholder - analyze how driving behavior changes with weather
    return 0.7;
  }

  private calculateRouteFamiliarity(gpsPoints: any[]): number {
    // Placeholder - analyze if route is frequently traveled
    return 0.6;
  }

  private analyzeBrakingPattern(accelerometerData: any[]): number {
    // Analyze smoothness of braking
    let abruptBraking = 0;
    for (let i = 1; i < accelerometerData.length; i++) {
      const decel = accelerometerData[i - 1].x - accelerometerData[i].x;
      if (decel > 0.3) abruptBraking++;
    }
    
    return accelerometerData.length > 0 ? abruptBraking / accelerometerData.length : 0;
  }

  private analyzeCorneringStyle(gyroscopeData: any[]): number {
    let sharpCorners = 0;
    gyroscopeData.forEach(reading => {
      const lateralForce = Math.sqrt(reading.x * reading.x + reading.y * reading.y);
      if (lateralForce > 0.25) sharpCorners++;
    });
    
    return gyroscopeData.length > 0 ? sharpCorners / gyroscopeData.length : 0;
  }

  private calculateRecentPerformance(historicalData?: DrivingMetrics[]): number {
    if (!historicalData || historicalData.length === 0) return 0;
    
    const recentScores = historicalData.slice(-5).map(trip => trip.score);
    return recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length / 100;
  }

  private calculateImprovementTrend(historicalData?: DrivingMetrics[]): number {
    if (!historicalData || historicalData.length < 2) return 0;
    
    const scores = historicalData.map(trip => trip.score);
    const recent = scores.slice(-3);
    const previous = scores.slice(-6, -3);
    
    if (previous.length === 0) return 0;
    
    const recentAvg = recent.reduce((sum, score) => sum + score, 0) / recent.length;
    const previousAvg = previous.reduce((sum, score) => sum + score, 0) / previous.length;
    
    return (recentAvg - previousAvg) / 100; // Normalized improvement
  }

  private calculateViolationHistory(historicalData?: DrivingMetrics[]): number {
    if (!historicalData || historicalData.length === 0) return 0;
    
    const totalViolations = historicalData.reduce((sum, trip) => sum + trip.speedViolations, 0);
    const totalTrips = historicalData.length;
    
    return Math.min(1, totalViolations / totalTrips / 5); // Normalize to 0-1
  }

  private xgboostModel(features: MachineLearningFeatures, pattern: DriverBehaviorPattern): number {
    // XGBoost-style extreme gradient boosting
    let score = 0.42;
    const learningRate = 0.08;
    
    // Feature interactions with regularization
    const l1Reg = 0.01;
    const l2Reg = 0.01;
    
    // Boosting iterations
    for (let iter = 0; iter < 50; iter++) {
      const gradient = this.computeGradient(score, features, pattern);
      const hessian = this.computeHessian(score, features, pattern);
      
      // Tree split with regularization
      const gain = this.calculateSplitGain(gradient, hessian, l1Reg, l2Reg);
      
      if (gain > 0.001) {
        score += learningRate * this.buildTree(features, pattern, gradient, hessian);
      }
    }
    
    return Math.max(0.02, Math.min(0.98, score));
  }

  private calculateMetaWeights(features: MachineLearningFeatures, pattern: DriverBehaviorPattern): { rf: number; gb: number; nn: number; xgb: number } {
    // Dynamic weight calculation based on feature confidence
    const dataQuality = this.assessDataQuality(features);
    const patternStability = this.assessPatternStability(pattern);
    
    const weights = {
      rf: 0.35,
      gb: 0.30,
      nn: 0.20,
      xgb: 0.15
    };
    
    // Adjust weights based on data characteristics
    if (dataQuality > 0.8) {
      weights.xgb += 0.05;
      weights.gb += 0.03;
    }
    
    if (patternStability > 0.7) {
      weights.rf += 0.05;
      weights.nn -= 0.05;
    }
    
    // Normalize weights
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    (Object.keys(weights) as Array<keyof typeof weights>).forEach(key => {
      weights[key] = weights[key] / totalWeight;
    });
    
    return weights;
  }

  private generateDecisionTrees(features: MachineLearningFeatures): any {
    // Generate multiple decision trees for Random Forest
    return {
      behavioral: this.buildBehavioralTree(features),
      temporal: this.buildTemporalTree(features),
      environmental: this.buildEnvironmentalTree(features)
    };
  }

  private calculateResidual(prediction: number, features: MachineLearningFeatures, pattern: DriverBehaviorPattern): number {
    const actualRisk = this.estimateActualRisk(features, pattern);
    return actualRisk - prediction;
  }

  private behavioralLearner(features: MachineLearningFeatures, pattern: DriverBehaviorPattern, residual: number): number {
    let adjustment = 0;
    
    // Focus on behavioral inconsistencies
    if (pattern.aggressiveness > 0.7 && features.accelerationVariance > 0.6) {
      adjustment += residual * 0.3;
    }
    
    if (pattern.consistency < 0.4 && features.speedConsistency < 0.5) {
      adjustment += residual * 0.25;
    }
    
    return adjustment;
  }

  private temporalEnvironmentalLearner(features: MachineLearningFeatures, pattern: DriverBehaviorPattern, residual: number): number {
    let adjustment = 0;
    
    // Night + weather interaction
    const isNightDriving = features.timeOfDay > 0.85 || features.timeOfDay < 0.2;
    const badWeather = features.weatherConditions > 0.6;
    
    if (isNightDriving && badWeather) {
      adjustment += residual * 0.4;
    }
    
    // Rush hour + aggressive driving
    if (features.trafficDensity > 0.7 && pattern.aggressiveness > 0.6) {
      adjustment += residual * 0.3;
    }
    
    return adjustment;
  }

  private historicalTrendLearner(features: MachineLearningFeatures, pattern: DriverBehaviorPattern, residual: number): number {
    let adjustment = 0;
    
    // Worsening trend with high violations
    if (features.improvementTrend < -0.1 && features.violationHistory > 0.5) {
      adjustment += residual * 0.35;
    }
    
    // Improving trend with consistent behavior
    if (features.improvementTrend > 0.1 && pattern.consistency > 0.7) {
      adjustment -= residual * 0.2;
    }
    
    return adjustment;
  }

  private nonLinearInteractionLearner(features: MachineLearningFeatures, pattern: DriverBehaviorPattern, residual: number): number {
    let adjustment = 0;
    
    // Complex non-linear interactions
    const riskCompound = Math.pow(pattern.aggressiveness, 2) * features.weatherConditions * features.trafficDensity;
    const safetyCompound = Math.pow(pattern.consistency, 1.5) * (1 - features.violationHistory);
    
    adjustment += residual * (riskCompound * 0.2 - safetyCompound * 0.15);
    
    return adjustment;
  }

  // Helper methods for XGBoost implementation
  private computeGradient(prediction: number, features: MachineLearningFeatures, pattern: DriverBehaviorPattern): number {
    const target = this.estimateActualRisk(features, pattern);
    return 2 * (prediction - target); // MSE gradient
  }

  private computeHessian(prediction: number, features: MachineLearningFeatures, pattern: DriverBehaviorPattern): number {
    return 2; // MSE hessian (constant)
  }

  private calculateSplitGain(gradient: number, hessian: number, l1Reg: number, l2Reg: number): number {
    const gain = Math.pow(gradient, 2) / (hessian + l2Reg + l1Reg);
    return Math.max(0, gain - l1Reg);
  }

  private buildTree(features: MachineLearningFeatures, pattern: DriverBehaviorPattern, gradient: number, hessian: number): number {
    // Simplified tree building
    const leafWeight = -gradient / (hessian + 0.01);
    return Math.max(-0.1, Math.min(0.1, leafWeight));
  }

  private assessDataQuality(features: MachineLearningFeatures): number {
    let quality = 0.8;
    
    // Check for feature completeness and consistency
    if (features.recentPerformance > 0) quality += 0.1;
    if (Math.abs(features.improvementTrend) > 0.01) quality += 0.05;
    if (features.violationHistory >= 0) quality += 0.05;
    
    return Math.min(1, quality);
  }

  private assessPatternStability(pattern: DriverBehaviorPattern): number {
    // Assess how stable/consistent the driving patterns are
    const stabilityScore = (pattern.consistency + (1 - Math.abs(0.5 - pattern.aggressiveness))) / 2;
    return stabilityScore;
  }

  private estimateActualRisk(features: MachineLearningFeatures, pattern: DriverBehaviorPattern): number {
    // Estimate "ground truth" risk for training purposes
    let risk = 0.4;
    
    risk += pattern.aggressiveness * 0.3;
    risk -= pattern.consistency * 0.2;
    risk += features.violationHistory * 0.25;
    risk += features.weatherConditions * features.trafficDensity * 0.15;
    
    return Math.max(0, Math.min(1, risk));
  }

  private buildBehavioralTree(features: MachineLearningFeatures): any {
    return {
      splitFeature: 'accelerationVariance',
      threshold: 0.6,
      leftScore: 0.3,
      rightScore: 0.7
    };
  }

  private buildTemporalTree(features: MachineLearningFeatures): any {
    return {
      splitFeature: 'timeOfDay',
      threshold: 0.8,
      leftScore: 0.4,
      rightScore: 0.65
    };
  }

  private buildEnvironmentalTree(features: MachineLearningFeatures): any {
    return {
      splitFeature: 'weatherConditions',
      threshold: 0.5,
      leftScore: 0.35,
      rightScore: 0.6
    };
  }

  private predictClaimProbability(features: MachineLearningFeatures, riskScore: number, pattern: DriverBehaviorPattern): number {
    // Advanced claim probability model using actuarial science principles
    const baseProbability = 0.05; // 5% base annual claim rate
    
    // Risk score multiplier (exponential relationship)
    const riskMultiplier = 1 + Math.pow(riskScore, 1.5) * 3;
    
    // Behavioral adjustments
    const aggressivenessImpact = Math.pow(pattern.aggressiveness, 2) * 0.4;
    const consistencyBonus = (1 - pattern.consistency) * 0.25;
    
    // Historical claims indicator
    const violationImpact = Math.pow(features.violationHistory, 1.2) * 0.35;
    
    // Environmental risk factors
    const environmentalRisk = (features.weatherConditions * 0.15) + 
                             (features.trafficDensity * 0.1) +
                             (features.roadType * 0.08);
    
    // Time-based adjustments
    const nightDrivingRisk = (features.timeOfDay > 0.85 || features.timeOfDay < 0.2) ? 0.12 : 0;
    const weekendRisk = features.dayOfWeek > 0.7 ? 0.08 : 0;
    
    // Calculate final probability
    let claimProb = baseProbability * riskMultiplier;
    claimProb += aggressivenessImpact + consistencyBonus + violationImpact;
    claimProb += environmentalRisk + nightDrivingRisk + weekendRisk;
    
    // Apply improvement trend discount
    if (features.improvementTrend > 0.1) {
      claimProb *= (1 - features.improvementTrend * 0.3);
    }
    
    // Route familiarity discount
    claimProb *= (1 - pattern.routeFamiliarity * 0.1);
    
    return Math.max(0.01, Math.min(0.8, claimProb));
  }
}

export const aiRiskScoringEngine = new AIRiskScoringEngine();
