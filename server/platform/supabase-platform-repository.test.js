import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectContentAssetUrls, incrementChatStartCountsBestEffort } from './supabase-platform-repository.js';

const createMockClient = ({ characterError = null, worldError = null } = {}) => ({
  from(table) {
    return {
      update() {
        return {
          async eq() {
            if (table === 'characters') {
              return { error: characterError };
            }
            if (table === 'worlds') {
              return { error: worldError };
            }
            return { error: null };
          },
        };
      },
    };
  },
});

test('incrementChatStartCountsBestEffort swallows update errors so room creation can continue', async () => {
  const client = createMockClient({
    characterError: new Error('new row violates row-level security policy for table "characters"'),
    worldError: new Error('new row violates row-level security policy for table "worlds"'),
  });

  await assert.doesNotReject(() =>
    incrementChatStartCountsBestEffort({
      client,
      character: { id: 'character-id', chat_start_count: 1 },
      world: { id: 'world-id', chat_start_count: 2 },
    })
  );
});

test('collectContentAssetUrls gathers cover and slot urls for storage cleanup', () => {
  const urls = collectContentAssetUrls({
    entityType: 'character',
    row: {
      cover_image_url: 'https://example.com/object/public/vmate-assets/user/character/main-detail.webp',
      avatar_image_url: 'https://example.com/object/public/vmate-assets/user/character/main-card.webp',
      prompt_profile_json: {
        imageSlots: [
          {
            thumbUrl: 'https://example.com/object/public/vmate-assets/user/character/main-thumb.webp',
            cardUrl: 'https://example.com/object/public/vmate-assets/user/character/main-card.webp',
            detailUrl: 'https://example.com/object/public/vmate-assets/user/character/main-detail.webp',
          },
          {
            detailUrl: 'https://example.com/object/public/vmate-assets/user/character/angry-detail.webp',
          },
        ],
      },
    },
    assets: [
      { url: 'https://example.com/object/public/vmate-assets/user/character/main-detail.webp' },
      { url: 'https://example.com/object/public/vmate-assets/user/character/angry-detail.webp' },
    ],
  });

  assert.deepEqual(urls, [
    'https://example.com/object/public/vmate-assets/user/character/main-detail.webp',
    'https://example.com/object/public/vmate-assets/user/character/main-card.webp',
    'https://example.com/object/public/vmate-assets/user/character/main-thumb.webp',
    'https://example.com/object/public/vmate-assets/user/character/angry-detail.webp',
  ]);
});
