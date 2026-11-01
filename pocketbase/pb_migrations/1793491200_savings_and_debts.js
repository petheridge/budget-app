/// <reference path="../pb_data/types.d.ts" />

// Savings & debts budgets: a budget's kind, two entry types for their items, and
// dated snapshots of each item's value so its history can be shown.
const AUTHED = "@request.auth.id != ''";

migrate(
  (app) => {
    // Empty means "budget", so existing budgets need no change.
    const budgets = app.findCollectionByNameOrId("budgets");
    budgets.fields.add(new SelectField({ name: "kind", values: ["budget", "tracker"], maxSelect: 1 }));
    app.save(budgets);

    const entries = app.findCollectionByNameOrId("entries");
    entries.fields.getByName("type").values = ["income", "expense", "saving", "debt"];
    app.save(entries);

    const snapshots = new Collection({
      type: "base",
      name: "snapshots",
      listRule: AUTHED,
      viewRule: AUTHED,
      createRule: AUTHED,
      updateRule: AUTHED,
      deleteRule: AUTHED,
      fields: [
        {
          name: "entry",
          type: "relation",
          collectionId: entries.id,
          maxSelect: 1,
          required: true,
          cascadeDelete: true,
        },
        // Not "required": PocketBase treats 0 as blank, and £0.00 is a valid value.
        { name: "amount_pence", type: "number", onlyInt: true, min: 0 },
        // The snapshot's date is when it was recorded.
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX idx_snapshots_entry ON snapshots (entry, created)"],
    });
    app.save(snapshots);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("snapshots"));

    // Down only works once no saving/debt items are left.
    const entries = app.findCollectionByNameOrId("entries");
    entries.fields.getByName("type").values = ["income", "expense"];
    app.save(entries);

    const budgets = app.findCollectionByNameOrId("budgets");
    budgets.fields.removeByName("kind");
    app.save(budgets);
  },
);
