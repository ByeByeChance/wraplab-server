import { Quote, VALID_QUOTE_TRANSITIONS } from './quote.entity';

describe('Quote Entity', () => {
  describe('VALID_QUOTE_TRANSITIONS', () => {
    it('should allow pending -> confirmed', () => {
      expect(VALID_QUOTE_TRANSITIONS.pending).toContain('confirmed');
    });

    it('should allow pending -> cancelled', () => {
      expect(VALID_QUOTE_TRANSITIONS.pending).toContain('cancelled');
    });

    it('should allow confirmed -> submitted', () => {
      expect(VALID_QUOTE_TRANSITIONS.confirmed).toContain('submitted');
    });

    it('should allow submitted -> followed_up', () => {
      expect(VALID_QUOTE_TRANSITIONS.submitted).toContain('followed_up');
    });

    it('should allow followed_up -> closed', () => {
      expect(VALID_QUOTE_TRANSITIONS.followed_up).toContain('closed');
    });

    it('should not allow completed -> cancelled (terminal state)', () => {
      expect(VALID_QUOTE_TRANSITIONS.closed).toEqual([]);
    });

    it('should not allow expired -> anything (terminal state)', () => {
      expect(VALID_QUOTE_TRANSITIONS.expired).toEqual([]);
    });
  });

  describe('updateStatus', () => {
    it('should update status when transition is valid', () => {
      const quote = new Quote();
      quote.status = 'pending';
      quote.updateStatus('confirmed');
      expect(quote.status).toBe('confirmed');
    });

    it('should throw when transition is invalid', () => {
      const quote = new Quote();
      quote.status = 'cancelled';
      expect(() => quote.updateStatus('confirmed')).toThrow('Invalid status transition');
    });

    it('should throw when transitioning from expired', () => {
      const quote = new Quote();
      quote.status = 'expired';
      expect(() => quote.updateStatus('confirmed')).toThrow('Invalid status transition');
    });

    it('should throw when transitioning back from closed', () => {
      const quote = new Quote();
      quote.status = 'closed';
      expect(() => quote.updateStatus('pending')).toThrow('Invalid status transition');
    });

    it('should allow pending -> expired', () => {
      const quote = new Quote();
      quote.status = 'pending';
      quote.updateStatus('expired');
      expect(quote.status).toBe('expired');
    });
  });
});
