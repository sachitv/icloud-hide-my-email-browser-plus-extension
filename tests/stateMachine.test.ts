import { describe, expect, it } from 'vitest';
import {
  PopupAction,
  PopupState,
  STATE_MACHINE_TRANSITIONS,
} from '../src/pages/Popup/stateMachine';

describe('STATE_MACHINE_TRANSITIONS', () => {
  const allTransitions: {
    fromState: PopupState;
    fromLabel: string;
    action: PopupAction;
    expectedState: PopupState;
    expectedLabel: string;
  }[] = [
    {
      fromState: PopupState.SignedOut,
      fromLabel: 'SignedOut',
      action: 'AUTHENTICATE',
      expectedState: PopupState.Authenticated,
      expectedLabel: 'Authenticated',
    },
    {
      fromState: PopupState.Authenticated,
      fromLabel: 'Authenticated',
      action: 'MANAGE',
      expectedState: PopupState.AuthenticatedAndManaging,
      expectedLabel: 'AuthenticatedAndManaging',
    },
    {
      fromState: PopupState.Authenticated,
      fromLabel: 'Authenticated',
      action: 'SIGN_OUT',
      expectedState: PopupState.SignedOut,
      expectedLabel: 'SignedOut',
    },
    {
      fromState: PopupState.AuthenticatedAndManaging,
      fromLabel: 'AuthenticatedAndManaging',
      action: 'GENERATE',
      expectedState: PopupState.Authenticated,
      expectedLabel: 'Authenticated',
    },
    {
      fromState: PopupState.AuthenticatedAndManaging,
      fromLabel: 'AuthenticatedAndManaging',
      action: 'SIGN_OUT',
      expectedState: PopupState.SignedOut,
      expectedLabel: 'SignedOut',
    },
  ];

  it.each(allTransitions)('$fromLabel + $action => $expectedLabel', ({
    fromState,
    action,
    expectedState,
  }) => {
    const transitions = STATE_MACHINE_TRANSITIONS[fromState] as Record<
      string,
      PopupState
    >;
    expect(transitions[action]).toBe(expectedState);
  });

  it('covers every state defined in the transition table', () => {
    const definedStates = Object.keys(STATE_MACHINE_TRANSITIONS).map(Number);
    expect(definedStates).toContain(PopupState.SignedOut);
    expect(definedStates).toContain(PopupState.Authenticated);
    expect(definedStates).toContain(PopupState.AuthenticatedAndManaging);
    expect(definedStates).toHaveLength(3);
  });

  it('has the correct number of actions per state', () => {
    const signedOut = STATE_MACHINE_TRANSITIONS[PopupState.SignedOut];
    const authenticated = STATE_MACHINE_TRANSITIONS[PopupState.Authenticated];
    const managing =
      STATE_MACHINE_TRANSITIONS[PopupState.AuthenticatedAndManaging];

    expect(Object.keys(signedOut as object)).toHaveLength(1);
    expect(Object.keys(authenticated as object)).toHaveLength(2);
    expect(Object.keys(managing as object)).toHaveLength(2);
  });
});
