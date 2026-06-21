
import { Coordinates } from '../types';

export const getCurrentPosition = (): Promise<Coordinates> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser."));
      return;
    }

    // Try high accuracy first with a 5s timeout
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        console.warn("High accuracy GPS failed, falling back to network positioning...", error.message);
        // Fallback to low accuracy (Wi-Fi/cell tower) with a generous timeout and cached age
        navigator.geolocation.getCurrentPosition(
          (fallbackPosition) => {
            resolve({
              latitude: fallbackPosition.coords.latitude,
              longitude: fallbackPosition.coords.longitude,
            });
          },
          (fallbackError) => {
            switch (fallbackError.code) {
              case fallbackError.PERMISSION_DENIED:
                reject(new Error("User denied Geolocation. Enable location permissions in your browser/device settings."));
                break;
              case fallbackError.POSITION_UNAVAILABLE:
                reject(new Error("Location information is unavailable."));
                break;
              case fallbackError.TIMEOUT:
                reject(new Error("The request to get user location timed out. Move closer to a window or outdoors."));
                break;
              default:
                reject(new Error("An unknown error occurred while getting location."));
                break;
            }
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 } // fallback can reuse cache up to 5 mins
        );
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 15000 }
    );
  });
};
