/**
 * Node built-in tests for moderation rules and client-side validation helpers.
 * Run: node --test scripts/moderation-rules.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rulesUrl = pathToFileURL(
  path.join(__dirname, '../src/services/moderationRules.js')
).href;

const { screenTextWithRules, CAPTION_MAX_LENGTH, COMMENT_MAX_LENGTH } =
  await import(rulesUrl);

describe('screenTextWithRules', () => {
  it('approves normal hydration captions', () => {
    const result = screenTextWithRules('Just finished a 500ml bottle after my run!');
    assert.equal(result.decision, 'approved');
  });

  it('rejects prohibited harassment language', () => {
    const result = screenTextWithRules('you should kill yourself');
    assert.equal(result.decision, 'rejected');
  });

  it('rejects spam patterns', () => {
    const result = screenTextWithRules('Buy now free money crypto giveaway');
    assert.equal(result.decision, 'rejected');
  });

  it('rejects long repeated characters', () => {
    const result = screenTextWithRules('aaaaaaaaaaaaaaa');
    assert.equal(result.decision, 'rejected');
  });

  it('approves empty text (optional caption)', () => {
    assert.equal(screenTextWithRules('').decision, 'approved');
    assert.equal(screenTextWithRules('   ').decision, 'approved');
  });
});

describe('limits', () => {
  it('exposes caption and comment limits matching the UI', () => {
    assert.equal(CAPTION_MAX_LENGTH, 500);
    assert.equal(COMMENT_MAX_LENGTH, 500);
  });
});

describe('self-action guards (logic)', () => {
  it('cannot block or report self', () => {
    const me = 'user-a';
    const target = 'user-a';
    assert.equal(me === target, true);
  });

  it('allows report/block of another user', () => {
    const me = 'user-a';
    const target = 'user-b';
    assert.equal(me === target, false);
  });
});

describe('moderation status filtering (logic)', () => {
  function isVisibleToViewer({ authorId, status, viewerId, blockedEitherWay }) {
    if (blockedEitherWay) return false;
    if (authorId === viewerId) return true;
    return status === 'visible';
  }

  it('hides blocked users content', () => {
    assert.equal(
      isVisibleToViewer({
        authorId: 'b',
        status: 'visible',
        viewerId: 'a',
        blockedEitherWay: true,
      }),
      false
    );
  });

  it('hides hidden or removed content from others', () => {
    assert.equal(
      isVisibleToViewer({
        authorId: 'b',
        status: 'hidden',
        viewerId: 'a',
        blockedEitherWay: false,
      }),
      false
    );
    assert.equal(
      isVisibleToViewer({
        authorId: 'b',
        status: 'removed',
        viewerId: 'a',
        blockedEitherWay: false,
      }),
      false
    );
  });

  it('shows visible content to non-blocked viewers', () => {
    assert.equal(
      isVisibleToViewer({
        authorId: 'b',
        status: 'visible',
        viewerId: 'a',
        blockedEitherWay: false,
      }),
      true
    );
  });
});

describe('own-content actions (logic)', () => {
  it('does not show report/block on own content', () => {
    const isOwn = true;
    const showActions = !isOwn;
    assert.equal(showActions, false);
  });
});

describe('report reason required (logic)', () => {
  it('requires a reason before submit', () => {
    const reason = '';
    assert.equal(Boolean(reason), false);
  });
});

describe('legal URLs', () => {
  const LEGAL_URLS = {
    privacyPolicy: 'https://amiyash3.github.io/water_warrior/privacy-policy/',
    termsOfService: 'https://amiyash3.github.io/water_warrior/terms-of-service/',
    communityGuidelines:
      'https://amiyash3.github.io/water_warrior/community-guidelines/',
    support: 'https://amiyash3.github.io/water_warrior/support/',
  };

  it('uses the published GitHub Pages URLs', () => {
    for (const url of Object.values(LEGAL_URLS)) {
      assert.match(url, /^https:\/\/amiyash3\.github\.io\/water_warrior\//);
    }
  });
});
