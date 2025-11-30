import { describe, expect, it, beforeEach } from 'bun:test'
import {
  buildPolymorphicGSIKey,
  createPolymorphicManager,
  morphMany,
  morphTo,
  parsePolymorphicGSIKey,
  PolymorphicRelationshipManager,
} from '../src'

describe('PolymorphicRelationshipManager', () => {
  describe('creation', () => {
    it('should create a polymorphic manager', () => {
      const manager = createPolymorphicManager()
      expect(manager).toBeInstanceOf(PolymorphicRelationshipManager)
    })
  })

  describe('registration', () => {
    let manager: PolymorphicRelationshipManager

    beforeEach(() => {
      manager = createPolymorphicManager()
    })

    it('should register a polymorphic relationship', () => {
      manager.register({
        name: 'commentable',
        typeAttribute: 'commentableType',
        idAttribute: 'commentableId',
        types: {
          Post: { entityType: 'Post', pkPrefix: 'POST#' },
          Video: { entityType: 'Video', pkPrefix: 'VIDEO#' },
        },
      })

      const names = manager.getRelationshipNames()
      expect(names).toContain('commentable')
    })

    it('should register multiple relationships', () => {
      manager.register({
        name: 'commentable',
        typeAttribute: 'commentableType',
        idAttribute: 'commentableId',
        types: {
          Post: { entityType: 'Post', pkPrefix: 'POST#' },
        },
      })
      manager.register({
        name: 'taggable',
        typeAttribute: 'taggableType',
        idAttribute: 'taggableId',
        types: {
          Article: { entityType: 'Article', pkPrefix: 'ART#' },
        },
      })

      const names = manager.getRelationshipNames()
      expect(names).toContain('commentable')
      expect(names).toContain('taggable')
    })

    it('should get relationship configuration', () => {
      manager.register({
        name: 'commentable',
        typeAttribute: 'commentableType',
        idAttribute: 'commentableId',
        types: {
          Post: { entityType: 'Post', pkPrefix: 'POST#' },
        },
      })

      const config = manager.getConfig('commentable')
      expect(config).toBeDefined()
      expect(config?.name).toBe('commentable')
      expect(config?.typeAttribute).toBe('commentableType')
    })

    it('should return undefined for non-existent relationship', () => {
      const config = manager.getConfig('nonexistent')
      expect(config).toBeUndefined()
    })

    it('should support chained registration', () => {
      manager
        .register({
          name: 'commentable',
          typeAttribute: 'commentableType',
          idAttribute: 'commentableId',
          types: { Post: { entityType: 'Post', pkPrefix: 'POST#' } },
        })
        .register({
          name: 'taggable',
          typeAttribute: 'taggableType',
          idAttribute: 'taggableId',
          types: { Article: { entityType: 'Article', pkPrefix: 'ART#' } },
        })

      expect(manager.getRelationshipNames()).toHaveLength(2)
    })
  })

  describe('morph attributes', () => {
    let manager: PolymorphicRelationshipManager

    beforeEach(() => {
      manager = createPolymorphicManager()
      manager.register({
        name: 'commentable',
        typeAttribute: 'commentableType',
        idAttribute: 'commentableId',
        types: {
          Post: { entityType: 'Post', pkPrefix: 'POST#' },
          Video: { entityType: 'Video', pkPrefix: 'VIDEO#' },
        },
      })
    })

    it('should get morph attributes', () => {
      const attrs = manager.getMorphAttributes('commentable', 'Post', '123')

      expect(attrs).toBeDefined()
      expect(attrs?.type).toBe('Post')
      expect(attrs?.id).toBe('123')
    })

    it('should return null for unknown relationship', () => {
      const attrs = manager.getMorphAttributes('unknown', 'Post', '123')
      expect(attrs).toBeNull()
    })

    it('should return null for unknown type', () => {
      const attrs = manager.getMorphAttributes('commentable', 'Unknown', '123')
      expect(attrs).toBeNull()
    })

    it('should set morph attributes on item', () => {
      const item = { content: 'Test comment' }
      const result = manager.setMorphAttributes('commentable', item, 'Post', '123')

      expect(result.commentableType).toBe('Post')
      expect(result.commentableId).toBe('123')
      expect(result.content).toBe('Test comment')
    })

    it('should preserve existing item attributes', () => {
      const item = { content: 'Test', extra: 'data' }
      const result = manager.setMorphAttributes('commentable', item, 'Video', '456')

      expect(result.extra).toBe('data')
    })
  })

  describe('extract morph info', () => {
    let manager: PolymorphicRelationshipManager

    beforeEach(() => {
      manager = createPolymorphicManager()
      manager.register({
        name: 'commentable',
        typeAttribute: 'commentableType',
        idAttribute: 'commentableId',
        types: {
          Post: { entityType: 'Post', pkPrefix: 'POST#' },
        },
      })
    })

    it('should extract morph info from item', () => {
      const item = {
        commentableType: 'Post',
        commentableId: '123',
        content: 'Great post!',
      }

      const info = manager.extractMorphInfo('commentable', item)

      expect(info?.type).toBe('Post')
      expect(info?.id).toBe('123')
    })

    it('should return null if type attribute missing', () => {
      const item = { commentableId: '123' }
      const info = manager.extractMorphInfo('commentable', item)
      expect(info).toBeNull()
    })

    it('should return null if id attribute missing', () => {
      const item = { commentableType: 'Post' }
      const info = manager.extractMorphInfo('commentable', item)
      expect(info).toBeNull()
    })

    it('should return null for unknown relationship', () => {
      const item = { type: 'Post', id: '123' }
      const info = manager.extractMorphInfo('unknown', item)
      expect(info).toBeNull()
    })
  })

  describe('build morph query', () => {
    let manager: PolymorphicRelationshipManager

    beforeEach(() => {
      manager = createPolymorphicManager()
      manager.register({
        name: 'commentable',
        typeAttribute: 'commentableType',
        idAttribute: 'commentableId',
        types: {
          Post: { entityType: 'Posts', pkPrefix: 'POST#' },
          Video: { entityType: 'Videos', pkPrefix: 'VIDEO#', skPrefix: 'META#' },
        },
      })
    })

    it('should build query for known type', () => {
      const query = manager.buildMorphQuery('commentable', 'Post', '123')

      expect(query).toBeDefined()
      expect(query?.tableName).toBe('Posts')
      expect(query?.pk).toBe('POST#123')
    })

    it('should include sk when defined', () => {
      const query = manager.buildMorphQuery('commentable', 'Video', '456')

      expect(query?.sk).toBe('META#456')
    })

    it('should not include sk when not defined', () => {
      const query = manager.buildMorphQuery('commentable', 'Post', '123')

      expect(query?.sk).toBeUndefined()
    })

    it('should return null for unknown relationship', () => {
      const query = manager.buildMorphQuery('unknown', 'Post', '123')
      expect(query).toBeNull()
    })

    it('should return null for unknown type', () => {
      const query = manager.buildMorphQuery('commentable', 'Unknown', '123')
      expect(query).toBeNull()
    })
  })
})

describe('buildPolymorphicGSIKey', () => {
  it('should build polymorphic GSI keys', () => {
    const key = buildPolymorphicGSIKey('Post', '123')
    expect(key).toBe('MORPH#Post#123')
  })

  it('should handle different types', () => {
    const postKey = buildPolymorphicGSIKey('Post', '1')
    const commentKey = buildPolymorphicGSIKey('Comment', '1')

    expect(postKey).not.toBe(commentKey)
  })

  it('should handle UUIDs', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const key = buildPolymorphicGSIKey('Post', uuid)
    expect(key).toBe(`MORPH#Post#${uuid}`)
  })

  it('should handle long type names', () => {
    const longType = 'VeryLongEntityTypeName'
    const key = buildPolymorphicGSIKey(longType, '123')
    expect(key).toContain(longType)
  })

  it('should handle empty type', () => {
    const key = buildPolymorphicGSIKey('', '123')
    expect(key).toBe('MORPH##123')
  })

  it('should handle empty id', () => {
    const key = buildPolymorphicGSIKey('Post', '')
    expect(key).toBe('MORPH#Post#')
  })
})

describe('parsePolymorphicGSIKey', () => {
  it('should parse polymorphic GSI keys', () => {
    const key = buildPolymorphicGSIKey('Post', '123')
    const parsed = parsePolymorphicGSIKey(key)

    expect(parsed).toBeDefined()
    expect(parsed?.type).toBe('Post')
    expect(parsed?.id).toBe('123')
  })

  it('should roundtrip correctly', () => {
    const originalType = 'Comment'
    const originalId = '456'
    const key = buildPolymorphicGSIKey(originalType, originalId)
    const parsed = parsePolymorphicGSIKey(key)

    expect(parsed?.type).toBe(originalType)
    expect(parsed?.id).toBe(originalId)
  })

  it('should return null for invalid keys', () => {
    const parsed = parsePolymorphicGSIKey('invalid-key')
    expect(parsed).toBeNull()
  })

  it('should return null for keys without MORPH prefix', () => {
    const parsed = parsePolymorphicGSIKey('Post#123')
    expect(parsed).toBeNull()
  })

  it('should handle UUIDs in keys', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const key = buildPolymorphicGSIKey('User', uuid)
    const parsed = parsePolymorphicGSIKey(key)

    expect(parsed?.id).toBe(uuid)
  })

  it('should return null for empty string', () => {
    const parsed = parsePolymorphicGSIKey('')
    expect(parsed).toBeNull()
  })

  it('should handle IDs containing hash', () => {
    const key = 'MORPH#Post#abc#def'
    const parsed = parsePolymorphicGSIKey(key)

    expect(parsed?.type).toBe('Post')
    expect(parsed?.id).toBe('abc#def')
  })
})

describe('morphTo', () => {
  it('should create morphTo config', () => {
    const config = morphTo({
      name: 'commentable',
      types: {
        Post: { entityType: 'Post', pkPrefix: 'POST#' },
      },
    })

    expect(config.name).toBe('commentable')
  })

  it('should use default type and id attributes', () => {
    const config = morphTo({
      name: 'commentable',
      types: {
        Post: { entityType: 'Post', pkPrefix: 'POST#' },
      },
    })

    expect(config.typeAttribute).toBe('commentableType')
    expect(config.idAttribute).toBe('commentableId')
  })

  it('should allow custom type attribute', () => {
    const config = morphTo({
      name: 'commentable',
      typeAttribute: 'target_type',
      types: { Post: { entityType: 'Post', pkPrefix: 'POST#' } },
    })

    expect(config.typeAttribute).toBe('target_type')
  })

  it('should allow custom id attribute', () => {
    const config = morphTo({
      name: 'commentable',
      idAttribute: 'target_id',
      types: { Post: { entityType: 'Post', pkPrefix: 'POST#' } },
    })

    expect(config.idAttribute).toBe('target_id')
  })

  it('should include types in config', () => {
    const config = morphTo({
      name: 'commentable',
      types: {
        Post: { entityType: 'Post', pkPrefix: 'POST#' },
        Video: { entityType: 'Video', pkPrefix: 'VIDEO#' },
      },
    })

    expect(config.types.Post).toBeDefined()
    expect(config.types.Video).toBeDefined()
  })
})

describe('morphMany', () => {
  it('should create morphMany config', () => {
    const config = morphMany({
      name: 'comments',
      localType: 'Post',
    })

    expect(config.name).toBe('comments')
  })

  it('should use default foreign attributes', () => {
    const config = morphMany({
      name: 'comments',
      localType: 'Post',
    })

    expect(config.foreignTypeAttribute).toBe('morphableType')
    expect(config.foreignIdAttribute).toBe('morphableId')
  })

  it('should allow custom foreign type attribute', () => {
    const config = morphMany({
      name: 'comments',
      foreignTypeAttribute: 'commentable_type',
      localType: 'Post',
    })

    expect(config.foreignTypeAttribute).toBe('commentable_type')
  })

  it('should allow custom foreign id attribute', () => {
    const config = morphMany({
      name: 'comments',
      foreignIdAttribute: 'commentable_id',
      localType: 'Post',
    })

    expect(config.foreignIdAttribute).toBe('commentable_id')
  })

  it('should include local type', () => {
    const config = morphMany({
      name: 'comments',
      localType: 'Post',
    })

    expect(config.localType).toBe('Post')
  })
})

describe('integration scenarios', () => {
  let manager: PolymorphicRelationshipManager

  beforeEach(() => {
    manager = createPolymorphicManager()
  })

  it('should handle comment on post workflow', () => {
    manager.register(morphTo({
      name: 'commentable',
      types: {
        Post: { entityType: 'Posts', pkPrefix: 'POST#' },
        Video: { entityType: 'Videos', pkPrefix: 'VIDEO#' },
      },
    }))

    // Create a comment pointing to a post
    const comment = { content: 'Great post!' }
    const commentWithMorph = manager.setMorphAttributes('commentable', comment, 'Post', '123')

    expect(commentWithMorph.commentableType).toBe('Post')
    expect(commentWithMorph.commentableId).toBe('123')

    // Later, resolve the reference
    const morphInfo = manager.extractMorphInfo('commentable', commentWithMorph)
    const query = manager.buildMorphQuery('commentable', morphInfo!.type, morphInfo!.id)

    expect(query?.tableName).toBe('Posts')
    expect(query?.pk).toBe('POST#123')
  })

  it('should handle multiple relationship types', () => {
    manager.register(morphTo({
      name: 'commentable',
      types: {
        Post: { entityType: 'Posts', pkPrefix: 'POST#' },
        Video: { entityType: 'Videos', pkPrefix: 'VIDEO#' },
      },
    }))

    manager.register(morphTo({
      name: 'likeable',
      types: {
        Post: { entityType: 'Posts', pkPrefix: 'POST#' },
        Comment: { entityType: 'Comments', pkPrefix: 'COMMENT#' },
      },
    }))

    // An item can have both commentable and likeable relationships
    const item = {}
    const withComment = manager.setMorphAttributes('commentable', item, 'Post', '1')
    const withBoth = manager.setMorphAttributes('likeable', withComment, 'Comment', '2')

    expect(withBoth.commentableType).toBe('Post')
    expect(withBoth.commentableId).toBe('1')
    expect(withBoth.likeableType).toBe('Comment')
    expect(withBoth.likeableId).toBe('2')
  })
})
