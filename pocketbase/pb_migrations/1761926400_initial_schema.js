/// <reference path="../pb_data/types.d.ts" />

// Household app: any authenticated user can read/write everything.
const AUTHED = "@request.auth.id != ''";
const RULES = {
  listRule: AUTHED,
  viewRule: AUTHED,
  createRule: AUTHED,
  updateRule: AUTHED,
  deleteRule: AUTHED,
};

const TIMESTAMPS = [
  { name: "created", type: "autodate", onCreate: true },
  { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
];

migrate(
  (app) => {
    const folders = new Collection({
      type: "base",
      name: "folders",
      ...RULES,
      fields: [
        { name: "name", type: "text", required: true },
        { name: "sort_order", type: "number", onlyInt: true },
        ...TIMESTAMPS,
      ],
    });
    app.save(folders);

    // Self-relation: added after the first save, once the collection has an id.
    folders.fields.add(
      new RelationField({ name: "parent", collectionId: folders.id, maxSelect: 1 }),
    );
    app.save(folders);

    const budgets = new Collection({
      type: "base",
      name: "budgets",
      ...RULES,
      fields: [
        { name: "name", type: "text", required: true },
        { name: "folder", type: "relation", collectionId: folders.id, maxSelect: 1 },
        { name: "sort_order", type: "number", onlyInt: true },
        ...TIMESTAMPS,
      ],
    });
    app.save(budgets);

    const entries = new Collection({
      type: "base",
      name: "entries",
      ...RULES,
      fields: [
        {
          name: "budget",
          type: "relation",
          collectionId: budgets.id,
          maxSelect: 1,
          required: true,
          cascadeDelete: true,
        },
        { name: "name", type: "text", required: true },
        // Not "required": PocketBase treats 0 as blank, and £0.00 entries are valid.
        { name: "amount_pence", type: "number", onlyInt: true, min: 0 },
        {
          name: "type",
          type: "select",
          values: ["income", "expense"],
          maxSelect: 1,
          required: true,
        },
        { name: "note", type: "text" },
        { name: "sort_order", type: "number", onlyInt: true },
        ...TIMESTAMPS,
      ],
    });
    app.save(entries);

    // The default users collection allows public sign-up; users are created in the admin UI only.
    const users = app.findCollectionByNameOrId("users");
    users.createRule = null;
    app.save(users);
  },
  (app) => {
    for (const name of ["entries", "budgets", "folders"]) {
      app.delete(app.findCollectionByNameOrId(name));
    }
    const users = app.findCollectionByNameOrId("users");
    users.createRule = "";
    app.save(users);
  },
);
