import { hasGraphqlCode } from './profile.guard';

describe('hasGraphqlCode', () => {
  it('matches graphQLErrors extension codes', () => {
    const error = {
      graphQLErrors: [{ extensions: { code: 'EMAIL_NOT_VERIFIED' } }],
    };
    expect(hasGraphqlCode(error, 'EMAIL_NOT_VERIFIED')).toBeTrue();
  });

  it('matches network error result extension codes', () => {
    const error = {
      networkError: {
        result: {
          errors: [{ extensions: { code: 'UNAUTHENTICATED' } }],
        },
      },
    };
    expect(hasGraphqlCode(error, 'UNAUTHENTICATED')).toBeTrue();
  });
});
