/// <reference path="../pb_data/types.d.ts" />

// Limits password sign-in attempts from one address, so a password can't be guessed
// at speed. Only sign-in is limited: the app's own reads and writes are not.
migrate(
  (app) => {
    const settings = app.settings();
    settings.rateLimits.enabled = true;
    settings.rateLimits.rules = [{ label: "*:authWithPassword", maxRequests: 10, duration: 60 }];
    app.save(settings);
  },
  (app) => {
    const settings = app.settings();
    settings.rateLimits.enabled = false;
    app.save(settings);
  },
);
