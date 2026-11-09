/// <reference path="../pb_data/types.d.ts" />

// A budget expense can be ticked off as paid. Empty means not paid, so existing
// entries need no change.
migrate(
  (app) => {
    const entries = app.findCollectionByNameOrId("entries");
    entries.fields.add(new BoolField({ name: "paid" }));
    app.save(entries);
  },
  (app) => {
    const entries = app.findCollectionByNameOrId("entries");
    entries.fields.removeByName("paid");
    app.save(entries);
  },
);
