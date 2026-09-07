export interface TelematicsData {
  gpsPoints: GPSPoint[];
  accelerometerData: AccelerometerReading[];
  gyroscopeData: GyroscopeReading[];
  speedData: SpeedReading[];
  timestamp: number;
}

export interface GPSPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number;
  speed?: number;
  heading?: number;
  altitude?: number;
}

export interface AccelerometerReading {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export interface GyroscopeReading {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export interface SpeedReading {
  speed: number;
  timestamp: number;
  speedLimit?: number;
}

export interface DeviceMotionPermission {
  granted: boolean;
  permission: PermissionState | 'prompt';
}

export class TelematicsCollector {
  private gpsPoints: GPSPoint[] = [];
  private accelerometerData: AccelerometerReading[] = [];
  private gyroscopeData: GyroscopeReading[] = [];
  private speedData: SpeedReading[] = [];
  private watchId: number | null = null;
  private motionListener: ((event: DeviceMotionEvent) => void) | null = null;
  private orientationListener: ((event: DeviceOrientationEvent) => void) | null = null;
  private isCollecting = false;
  
  constructor() {
    // Bind methods will be done when they're defined
  }

  async requestPermissions(): Promise<DeviceMotionPermission> {
    // Request location permission
    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported by this browser');
    }

    // Request device motion permission (iOS 13+)
    // iOS gates motion behind a permission prompt that the standard DOM lib
    // does not declare, so the constructor is read through the shape that
    // carries it rather than through `any`.
    const motionEvent = typeof DeviceMotionEvent !== 'undefined'
      ? (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> })
      : undefined;
    if (typeof motionEvent?.requestPermission === 'function') {
      try {
        const permission = await motionEvent.requestPermission();
        return {
          granted: permission === 'granted',
          permission: permission as PermissionState
        };
      } catch (error) {
        console.error('Error requesting device motion permission:', error);
        return { granted: false, permission: 'denied' };
      }
    }

    // For non-iOS devices, assume permission is granted
    return { granted: true, permission: 'granted' };
  }

  async startCollection(): Promise<void> {
    if (this.isCollecting) {
      console.warn('Telematics collection is already active');
      return;
    }

    const permission = await this.requestPermissions();
    if (!permission.granted) {
      throw new Error('Device motion permission denied');
    }

    this.isCollecting = true;
    this.clearData();

    // Start GPS tracking
    this.startGPSTracking();
    
    // Start motion sensors
    this.startMotionTracking();
    
    console.log('Telematics collection started');
  }

  stopCollection(): TelematicsData {
    if (!this.isCollecting) {
      console.warn('Telematics collection is not active');
      return this.getCurrentData();
    }

    this.isCollecting = false;

    // Stop GPS tracking
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    // Stop motion tracking
    if (this.motionListener) {
      window.removeEventListener('devicemotion', this.motionListener);
      this.motionListener = null;
    }

    if (this.orientationListener) {
      window.removeEventListener('deviceorientation', this.orientationListener);
      this.orientationListener = null;
    }

    console.log('Telematics collection stopped');
    return this.getCurrentData();
  }

  private startGPSTracking(): void {
    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 1000
    };

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const gpsPoint: GPSPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: Date.now(),
          accuracy: position.coords.accuracy,
          speed: position.coords.speed || undefined,
          heading: position.coords.heading || undefined,
          altitude: position.coords.altitude || undefined
        };

        this.gpsPoints.push(gpsPoint);

        // Add speed data if available
        if (position.coords.speed !== null) {
          this.speedData.push({
            speed: position.coords.speed * 2.237, // Convert m/s to mph
            timestamp: Date.now()
          });
        }

        // Limit data points to prevent memory issues
        if (this.gpsPoints.length > 1000) {
          this.gpsPoints = this.gpsPoints.slice(-500);
        }
        if (this.speedData.length > 1000) {
          this.speedData = this.speedData.slice(-500);
        }
      },
      (error) => {
        console.error('GPS tracking error:', error);
      },
      options
    );
  }

  private startMotionTracking(): void {
    // Device motion (accelerometer + gyroscope)
    this.motionListener = (event: DeviceMotionEvent) => {
      const timestamp = Date.now();

      // Accelerometer data
      if (event.acceleration) {
        this.accelerometerData.push({
          x: event.acceleration.x || 0,
          y: event.acceleration.y || 0,
          z: event.acceleration.z || 0,
          timestamp
        });
      }

      // Gyroscope data
      if (event.rotationRate) {
        this.gyroscopeData.push({
          x: event.rotationRate.alpha || 0,
          y: event.rotationRate.beta || 0,
          z: event.rotationRate.gamma || 0,
          timestamp
        });
      }

      // Limit data points
      if (this.accelerometerData.length > 2000) {
        this.accelerometerData = this.accelerometerData.slice(-1000);
      }
      if (this.gyroscopeData.length > 2000) {
        this.gyroscopeData = this.gyroscopeData.slice(-1000);
      }
    };

    window.addEventListener('devicemotion', this.motionListener);

    // Device orientation
    this.orientationListener = (event: DeviceOrientationEvent) => {
      // Optional: Use orientation data for additional context
      console.debug('Device orientation:', {
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma
      });
    };

    window.addEventListener('deviceorientation', this.orientationListener);
  }

  private clearData(): void {
    this.gpsPoints = [];
    this.accelerometerData = [];
    this.gyroscopeData = [];
    this.speedData = [];
  }

  getCurrentData(): TelematicsData {
    return {
      gpsPoints: [...this.gpsPoints],
      accelerometerData: [...this.accelerometerData],
      gyroscopeData: [...this.gyroscopeData],
      speedData: [...this.speedData],
      timestamp: Date.now()
    };
  }

  isActive(): boolean {
    return this.isCollecting;
  }

  getDataSummary() {
    return {
      gpsPoints: this.gpsPoints.length,
      accelerometerReadings: this.accelerometerData.length,
      gyroscopeReadings: this.gyroscopeData.length,
      speedReadings: this.speedData.length,
      duration: this.gpsPoints.length > 0 ? 
        (this.gpsPoints[this.gpsPoints.length - 1].timestamp - this.gpsPoints[0].timestamp) / 1000 : 0
    };
  }

  // Utility method to simulate haptic feedback
  simulateHapticFeedback(type: 'light' | 'medium' | 'heavy' = 'light'): void {
    if (navigator.vibrate) {
      const patterns = {
        light: 10,
        medium: 20,
        heavy: 50
      };
      navigator.vibrate(patterns[type]);
    }
  }
}

export const telematicsCollector = new TelematicsCollector();
