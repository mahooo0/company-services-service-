describe('ServicesService', () => {
  describe('reorder()', () => {
    it.todo('updates sortOrder for all provided service IDs in a single transaction');
    it.todo('throws BadRequestException when any service ID does not belong to the organization');
    it.todo('only updates services mentioned in the payload, leaves others unchanged');
    it.todo('handles empty items array without throwing');
  });
});
