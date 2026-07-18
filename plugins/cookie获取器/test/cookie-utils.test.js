import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_DATA_FORMAT,
  cookieIdentity,
  filterCookies,
  matchesDomain,
  mergeCookieLists,
  renderDataFormat,
  serializeCookieHeader,
  sortCookiesByName,
  snapshotFingerprint,
  validateBackendUrl,
  validateDataFormat,
  validateRegexFilters
} from '../cookie-utils.js';

function cookie(overrides = {}) {
  return {
    name: 'sid',
    value: 'one',
    domain: 'example.com',
    path: '/',
    storeId: '0',
    ...overrides
  };
}

test('Cookie identity preserves raw domain, path, store and partition key', () => {
  const base = cookie();
  assert.notEqual(cookieIdentity(base), cookieIdentity(cookie({ domain: '.example.com' })));
  assert.notEqual(cookieIdentity(base), cookieIdentity(cookie({ path: '/admin' })));
  assert.notEqual(cookieIdentity(base), cookieIdentity(cookie({ storeId: '1' })));
  assert.notEqual(
    cookieIdentity(base),
    cookieIdentity(cookie({ partitionKey: { topLevelSite: 'https://top.example' } }))
  );
});

test('Merge preserves query order and same-name cookies with distinct identity', () => {
  const hostOnly = cookie({ value: 'host' });
  const domainScoped = cookie({ value: 'domain', domain: '.example.com' });
  const partitioned = cookie({
    value: 'partitioned',
    partitionKey: { topLevelSite: 'https://top.example', hasCrossSiteAncestor: false }
  });
  assert.deepEqual(
    mergeCookieLists([hostOnly, domainScoped], [partitioned, hostOnly]),
    [hostOnly, domainScoped, partitioned]
  );
});

test('Cookie header serialization preserves duplicates and empty snapshots', () => {
  assert.equal(serializeCookieHeader([cookie(), cookie({ value: 'two', path: '/two' })]), 'sid=one; sid=two');
  assert.equal(serializeCookieHeader([]), '');
});

test('DevTools-style name sorting keeps duplicate-name order stable', () => {
  const cookies = [
    cookie({ name: 'locale_messaged' }),
    cookie({ name: '_greasyfork_session' }),
    cookie({ name: 'cf_clearance' }),
    cookie({ name: '_ga_7NMRNRYW7C' }),
    cookie({ name: '_ga', path: '/first' }),
    cookie({ name: '_ga', path: '/second' })
  ];
  assert.deepEqual(
    sortCookiesByName(cookies).map(item => `${item.name}:${item.path}`),
    [
      '_ga:/first',
      '_ga:/second',
      '_ga_7NMRNRYW7C:/',
      '_greasyfork_session:/',
      'cf_clearance:/',
      'locale_messaged:/'
    ]
  );
});

test('Domain and Cookie key filters support include, exclude and regex modes', () => {
  assert.equal(matchesDomain('.Example.com', ['example']), true);
  assert.equal(matchesDomain('example.com', ['^example\\.com$'], true), true);
  assert.deepEqual(filterCookies([cookie(), cookie({ name: 'theme' })], ['sid']), [cookie()]);
  assert.deepEqual(filterCookies([cookie(), cookie({ name: 'theme' })], ['sid'], true), [cookie({ name: 'theme' })]);
  assert.throws(() => validateRegexFilters(['[']), /无效的域名正则表达式/);
});

test('Template rendering supports new and legacy placeholders repeatedly', () => {
  const context = {
    domain: '.example.com',
    storeId: '1',
    partitionKey: { topLevelSite: 'https://top.example' },
    event: { removed: true, cause: 'explicit', cookie: cookie({ value: '<tag>' }) },
    cookies: [cookie({ value: 'quote"value {domain} {event} {cookies}' })]
  };
  const rendered = renderDataFormat(DEFAULT_DATA_FORMAT, context);
  const parsed = JSON.parse(rendered);
  assert.equal(parsed.domain, 'example.com');
  assert.equal(parsed.storeId, '1');
  assert.equal(parsed.event.cookie.value, '<tag>');
  assert.equal(parsed.cookies[0].value, 'quote"value {domain} {event} {cookies}');

  const legacy = validateDataFormat('{"a":"{domain}","b":"{domain}","cookies":{cookies}}', context);
  assert.deepEqual(JSON.parse(legacy).cookies, context.cookies);
  assert.throws(() => validateDataFormat('{"cookies":"{cookies}"}', context), SyntaxError);
});

test('Snapshot fingerprint changes for meaningful properties and supports empty arrays', () => {
  assert.equal(snapshotFingerprint([]), '[]');
  assert.equal(snapshotFingerprint([cookie()]), snapshotFingerprint([cookie()]));
  assert.notEqual(snapshotFingerprint([cookie()]), snapshotFingerprint([cookie({ value: 'two' })]));
  assert.notEqual(snapshotFingerprint([cookie()]), snapshotFingerprint([cookie({ httpOnly: true })]));
});

test('Backend URL validation only permits HTTPS and local HTTP development hosts', () => {
  assert.equal(validateBackendUrl('https://example.com/hook'), 'https://example.com/hook');
  assert.equal(validateBackendUrl('http://localhost:8080/hook'), 'http://localhost:8080/hook');
  assert.equal(validateBackendUrl('http://127.0.0.1/hook'), 'http://127.0.0.1/hook');
  assert.throws(() => validateBackendUrl('http://example.com/hook'), /必须使用 HTTPS/);
  assert.throws(() => validateBackendUrl('http://[::1]/hook'), /必须使用 HTTPS/);
});
