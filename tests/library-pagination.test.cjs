const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const knex = require('knex');

function repository() {
    const db = knex({ client: 'pg' });
    const queries = [];
    // Execute the real Knex query builders without a database connection.
    db.client.runner = (builder) => ({
        run: async () => {
            const query = builder.toSQL();
            queries.push(query);
            return query.sql.includes('count(') ? { count: '23' } : [];
        },
    });
    const source = readFileSync(path.join(__dirname, '../src/modules/library/library.repository.ts'), 'utf8');
    const output = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', output)((name) => {
        assert.equal(name, '../../config/db');
        return { db };
    }, module, module.exports);
    return { api: module.exports, queries };
}

test('ALL sorts by duration before limit/offset with deterministic ties and nulls last', async () => {
    const { api, queries } = repository();
    const result = await api.getPaginatedLibraryItems(2, 10, undefined, [1, 2]);
    const items = queries.find((q) => !q.sql.includes('count('));
    const count = queries.find((q) => q.sql.includes('count('));
    assert.match(items.sql, /order by "duration_seconds" desc nulls last, "sort_order" asc, "id" asc limit \? offset \?/);
    assert.deepEqual(items.bindings.slice(-2), [10, 10]);
    assert.match(items.sql, /plan_ids && ARRAY\[\?,\?\]::integer\[\]/);
    assert.match(count.sql, /plan_ids && ARRAY\[\?,\?\]::integer\[\]/);
    assert.ok(items.bindings.includes(true));
    assert.ok(count.bindings.includes(true));
    assert.equal(result.total, 23);
});

test('a category keeps its lesson order and applies its filter to the total', async () => {
    const { api, queries } = repository();
    await api.getPaginatedLibraryItems(1, 10, 'SEO', undefined);
    const items = queries.find((q) => !q.sql.includes('count('));
    assert.match(items.sql, /order by "sort_order" asc, "id" asc/);
    assert.doesNotMatch(items.sql, /order by "duration_seconds"/);
    for (const query of queries) {
        assert.match(query.sql, /"category" = \?/);
        assert.ok(query.bindings.includes('SEO'));
    }
});

test('search is parameterized, escapes wildcard characters, and filters the total', async () => {
    const { api, queries } = repository();
    await api.getPaginatedLibraryItems(1, 10, undefined, [1], '100%_match');
    for (const query of queries) {
        assert.match(query.sql, /"title" ilike \?/);
        assert.ok(query.bindings.includes('%100\\%\\_match%'));
        assert.doesNotMatch(query.sql, /100%/);
    }
});

test('a user with no accessible plans cannot retrieve items or counts', async () => {
    const { api, queries } = repository();
    await api.getPaginatedLibraryItems(1, 10, undefined, []);
    for (const query of queries) assert.match(query.sql, /and false/);
});

test('category navigation prioritizes the requested five collections then uses the existing order', async () => {
    const { api, queries } = repository();
    await api.getLibraryCategories([1]);
    const query = queries[0];
    assert.match(query.sql, /group by "category" order by CASE regexp_replace\(lower\(category\), '\[\^a-z0-9\]', '', 'g'\)/);
    assert.match(query.sql, /ELSE 5 END ASC, MIN\(sort_order\) ASC$/);
    assert.deepEqual(query.bindings.slice(-12), [
        'boostyourgoogleandyoutuberankingswithseo', 0,
        'bestgoogleandyoutubeorganicsearchengineoptimizationorseostrategies', 0,
        'theorganizedlife', 1,
        'smarttimelaunchpad', 2,
        'zoommeetingmasterclass', 3,
        'productivitymastery', 4,
    ]);
    assert.match(query.sql, /plan_ids && ARRAY\[\?\]::integer\[\]/);
});
