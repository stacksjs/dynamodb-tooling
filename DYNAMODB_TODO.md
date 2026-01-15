# DynamoDB Tooling TODO

## DynamoDB ORM Driver

### Stacks Models to Single Table Design
**Status:** Needs Work
**Description:** Build special DynamoDB "ORM driver"/tool where Stacks models are transformed to single table designs. Perfect use case for pantry registry API.

**Tasks:**
- [ ] Finish DynamoDB ORM driver
- [ ] Transform Stacks models to single table design
- [ ] Define access patterns for common queries
- [ ] Implement GSI (Global Secondary Index) strategies
- [ ] Add migration tooling for schema changes
- [ ] Document single table design patterns

---

## Use Cases

- Pantry registry API backend
- Fathom analytics alternative storage
- Heatmap data storage
- Any high-scale, low-latency data needs

---

## Notes

- Single table design is the recommended pattern for DynamoDB
- Should integrate with bun-query-builder's DynamoDB driver
- Stacks models should be easily transformable to DynamoDB items
