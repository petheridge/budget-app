/// <reference path="../pb_data/types.d.ts" />

// A budget expense can be linked to a saving or debt it pays into, shown as a label
// on both. Not required: deleting the saving or debt clears it.
migrate(
  (app) => {
    const entries = app.findCollectionByNameOrId("entries");
    entries.fields.add(new RelationField({ name: "link", collectionId: entries.id, maxSelect: 1 }));
    app.save(entries);
  },
  (app) => {
    const entries = app.findCollectionByNameOrId("entries");
    entries.fields.removeByName("link");
    app.save(entries);
  },
);
