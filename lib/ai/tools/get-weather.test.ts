import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getWeather } from './get-weather';

// Mock fetch globally
global.fetch = vi.fn();

describe('Get Weather Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('tool configuration', () => {
    it('should have correct description', () => {
      expect(getWeather.description).toBe('Get the current weather at a location');
    });

    it('should have correct parameter schema', () => {
      const schema = getWeather.parameters;
      
      // Test valid parameters
      expect(() => schema.parse({ latitude: 40.7128, longitude: -74.0060 })).not.toThrow();
      
      // Test invalid parameters
      expect(() => schema.parse({ latitude: 'invalid', longitude: -74.0060 })).toThrow();
      expect(() => schema.parse({ latitude: 40.7128 })).toThrow(); // missing longitude
      expect(() => schema.parse({ longitude: -74.0060 })).toThrow(); // missing latitude
      expect(() => schema.parse({})).toThrow(); // missing both
    });

    it('should validate latitude and longitude as numbers', () => {
      const schema = getWeather.parameters;
      
      // Valid coordinates
      expect(() => schema.parse({ latitude: 0, longitude: 0 })).not.toThrow();
      expect(() => schema.parse({ latitude: -90, longitude: -180 })).not.toThrow();
      expect(() => schema.parse({ latitude: 90, longitude: 180 })).not.toThrow();
      expect(() => schema.parse({ latitude: 40.7128, longitude: -74.0060 })).not.toThrow();
    });
  });

  describe('execute function', () => {
    it('should make correct API call to Open-Meteo', async () => {
      const mockWeatherData = {
        current: { temperature_2m: 22.5 },
        hourly: { temperature_2m: [20, 21, 22, 23] },
        daily: { sunrise: ['2024-01-01T07:30'], sunset: ['2024-01-01T17:45'] }
      };

      const mockResponse = {
        json: vi.fn().mockResolvedValue(mockWeatherData),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await getWeather.execute({ latitude: 40.7128, longitude: -74.0060 });

      const fetchCall = (global.fetch as any).mock.calls[0][0];
      expect(fetchCall).toContain('latitude=40.7128');
      expect(fetchCall).toContain('longitude=-74.006');
      expect(fetchCall).toContain('api.open-meteo.com');
      expect(result).toEqual(mockWeatherData);
    });

    it('should handle different coordinate formats', async () => {
      const mockWeatherData = { current: { temperature_2m: 25.0 } };
      const mockResponse = {
        json: vi.fn().mockResolvedValue(mockWeatherData),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      // Test with integer coordinates
      await getWeather.execute({ latitude: 51, longitude: 0 });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('latitude=51&longitude=0')
      );

      // Test with negative coordinates
      await getWeather.execute({ latitude: -33.8688, longitude: 151.2093 });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('latitude=-33.8688&longitude=151.2093')
      );

      // Test with zero coordinates
      await getWeather.execute({ latitude: 0, longitude: 0 });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('latitude=0&longitude=0')
      );
    });

    it('should include all required API parameters', async () => {
      const mockWeatherData = { current: { temperature_2m: 18.5 } };
      const mockResponse = {
        json: vi.fn().mockResolvedValue(mockWeatherData),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      await getWeather.execute({ latitude: 48.8566, longitude: 2.3522 });

      const fetchCall = (global.fetch as any).mock.calls[0][0];
      const url = new URL(fetchCall);

      expect(url.hostname).toBe('api.open-meteo.com');
      expect(url.pathname).toBe('/v1/forecast');
      expect(url.searchParams.get('latitude')).toBe('48.8566');
      expect(url.searchParams.get('longitude')).toBe('2.3522');
      expect(url.searchParams.get('current')).toBe('temperature_2m');
      expect(url.searchParams.get('hourly')).toBe('temperature_2m');
      expect(url.searchParams.get('daily')).toBe('sunrise,sunset');
      expect(url.searchParams.get('timezone')).toBe('auto');
    });

    it('should handle API response correctly', async () => {
      const expectedWeatherData = {
        latitude: 40.7,
        longitude: -74.0,
        timezone: 'America/New_York',
        current: {
          time: '2024-01-01T12:00',
          temperature_2m: 15.2
        },
        hourly: {
          time: ['2024-01-01T00:00', '2024-01-01T01:00'],
          temperature_2m: [12.1, 12.8]
        },
        daily: {
          time: ['2024-01-01'],
          sunrise: ['2024-01-01T07:20'],
          sunset: ['2024-01-01T17:45']
        }
      };

      const mockResponse = {
        json: vi.fn().mockResolvedValue(expectedWeatherData),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await getWeather.execute({ latitude: 40.7, longitude: -74.0 });

      expect(mockResponse.json).toHaveBeenCalledOnce();
      expect(result).toEqual(expectedWeatherData);
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      await expect(getWeather.execute({ latitude: 40.7128, longitude: -74.0060 }))
        .rejects.toThrow('Network error');
    });

    it('should handle API errors', async () => {
      const mockResponse = {
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      await expect(getWeather.execute({ latitude: 40.7128, longitude: -74.0060 }))
        .rejects.toThrow('Invalid JSON');
    });

    it('should handle extreme coordinates', async () => {
      const mockWeatherData = { current: { temperature_2m: -30.0 } };
      const mockResponse = {
        json: vi.fn().mockResolvedValue(mockWeatherData),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      // Test Arctic coordinates
      await getWeather.execute({ latitude: 85.0, longitude: 0.0 });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('latitude=85&longitude=0')
      );

      // Test Antarctic coordinates
      await getWeather.execute({ latitude: -85.0, longitude: 180.0 });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('latitude=-85&longitude=180')
      );
    });

    it('should preserve decimal precision in coordinates', async () => {
      const mockWeatherData = { current: { temperature_2m: 20.0 } };
      const mockResponse = {
        json: vi.fn().mockResolvedValue(mockWeatherData),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      // Test high precision coordinates
      await getWeather.execute({ latitude: 40.712775, longitude: -74.005973 });
      
      const fetchCall = (global.fetch as any).mock.calls[0][0];
      expect(fetchCall).toContain('latitude=40.712775');
      expect(fetchCall).toContain('longitude=-74.005973');
    });

    it('should handle empty or minimal API response', async () => {
      const minimalResponse = {};
      const mockResponse = {
        json: vi.fn().mockResolvedValue(minimalResponse),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await getWeather.execute({ latitude: 0, longitude: 0 });
      
      expect(result).toEqual(minimalResponse);
    });
  });

  describe('real-world scenarios', () => {
    it('should work with major city coordinates', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({ current: { temperature_2m: 25 } }),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      // Major cities test cases
      const cities = [
        { name: 'New York', lat: 40.7128, lon: -74.0060 },
        { name: 'London', lat: 51.5074, lon: -0.1278 },
        { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
        { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
        { name: 'São Paulo', lat: -23.5558, lon: -46.6396 },
      ];

      for (const city of cities) {
        await getWeather.execute({ latitude: city.lat, longitude: city.lon });
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`latitude=${city.lat}&longitude=${city.lon}`)
        );
      }
    });

    it('should handle typical API response structure', async () => {
      const typicalResponse = {
        latitude: 40.7,
        longitude: -74.0,
        generationtime_ms: 0.123,
        utc_offset_seconds: -18000,
        timezone: 'America/New_York',
        timezone_abbreviation: 'EST',
        elevation: 10.0,
        current_units: { time: 'iso8601', temperature_2m: '°C' },
        current: {
          time: '2024-01-01T12:00',
          temperature_2m: 22.5
        },
        hourly_units: { time: 'iso8601', temperature_2m: '°C' },
        hourly: {
          time: Array(24).fill(0).map((_, i) => `2024-01-01T${i.toString().padStart(2, '0')}:00`),
          temperature_2m: Array(24).fill(0).map((_, i) => 20 + Math.sin(i / 24 * Math.PI * 2) * 5)
        },
        daily_units: { time: 'iso8601', sunrise: 'iso8601', sunset: 'iso8601' },
        daily: {
          time: ['2024-01-01'],
          sunrise: ['2024-01-01T07:20'],
          sunset: ['2024-01-01T17:45']
        }
      };

      const mockResponse = {
        json: vi.fn().mockResolvedValue(typicalResponse),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await getWeather.execute({ latitude: 40.7, longitude: -74.0 });
      
      expect(result).toEqual(typicalResponse);
      expect(result.current.temperature_2m).toBe(22.5);
      expect(result.hourly.temperature_2m).toHaveLength(24);
      expect(result.daily.sunrise).toEqual(['2024-01-01T07:20']);
    });
  });
});