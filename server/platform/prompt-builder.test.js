import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRoomPromptSnapshot } from './prompt-builder.js';

test('buildRoomPromptSnapshot includes character and world image-slot guidance for runtime switching', () => {
  const snapshot = buildRoomPromptSnapshot({
    character: {
      name: '카엘',
      headline: '무심하지만 챙겨주는 인물',
      summary: '요약',
      promptProfile: {
        persona: ['무심하지만 다정하다.'],
        speechStyle: ['짧고 건조한 말투'],
        relationshipBaseline: '낯설지만 금방 가까워질 수 있다.',
        imageSlots: [
          { slot: 'battle', usage: '전투 장면', trigger: '긴장감이 급격히 올라가거나 대치가 시작될 때' },
        ],
      },
    },
    world: {
      name: '현실의 도쿄',
      headline: '심야 골목',
      summary: '요약',
      promptProfile: {
        rules: ['현실적인 심야 도시 톤을 유지한다.'],
        tone: '차갑고 눅눅한 심야 공기',
        starterLocations: ['편의점 앞'],
        worldTerms: ['심야', '편의점'],
        imageSlots: [
          { slot: 'night-rain', usage: '비 오는 골목', trigger: '비가 오거나 젖은 도로가 강조되는 장면' },
        ],
      },
    },
    bridgeProfile: {
      entryMode: 'in_world',
      characterRoleInWorld: '심야를 함께 걷는 인물',
      userRoleInWorld: '같은 장면을 공유하는 상대',
      meetingTrigger: '비가 막 그친 밤, 대화를 시작할 타이밍이 온다.',
      relationshipDistance: '서로 아직 조심스럽다.',
      currentGoal: '짧은 장면 안에서 감정선을 만든다.',
      startingLocation: '편의점 앞',
      worldTerms: ['심야', '편의점'],
      firstScenePressure: '짧은 시간 안에 감정선이 드러나야 한다.',
    },
    state: {
      currentSituation: '비가 막 그친 밤, 대화를 시작할 타이밍이 온다.',
      location: '편의점 앞',
      relationshipState: '서로 아직 조심스럽다.',
      inventory: [],
      appearance: [],
      pose: [],
      futurePromises: [],
      worldNotes: ['심야', '편의점'],
    },
  });

  assert.match(snapshot, /Character image slot battle/i);
  assert.match(snapshot, /World image slot night-rain/i);
  assert.match(snapshot, /character_image_slot/i);
  assert.match(snapshot, /world_image_slot/i);
});
