import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createCharacter, createWorld, getHomePayload, resetPlatformStoreForTests } from './content-store.js';

afterEach(() => {
  resetPlatformStoreForTests();
});

test('created content exposes creator nickname from payload', () => {
  createCharacter({
    userId: 'user-1',
    payload: {
      name: '테스트 캐릭터',
      headline: '한 줄 소개',
      summary: '요약',
      tags: [],
      visibility: 'public',
      sourceType: 'original',
      profileJson: { creatorName: '닉네임' },
    },
  });

  createWorld({
    userId: 'user-1',
    payload: {
      name: '테스트 월드',
      headline: '한 줄 설명',
      summary: '요약',
      tags: [],
      visibility: 'public',
      sourceType: 'original',
      promptProfileJson: { creatorName: '닉네임' },
    },
  });

  const payload = getHomePayload();
  assert.equal(payload.home.characterFeed.items[0]?.creator.name, '닉네임');
  assert.equal(payload.home.worldFeed.items[0]?.creator.name, '닉네임');
});
