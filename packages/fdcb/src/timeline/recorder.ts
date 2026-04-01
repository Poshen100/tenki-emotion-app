/**
 * @module timeline/recorder
 * @description Records timeline events during FDCB decision sessions.
 * Each session maintains an ordered list of biometric+event nodes.
 */

import type { TimelineNode, TimelineSession } from './types';

/** Generates a UUID v4 string */
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Input for adding a node (auto-generated fields omitted) */
export type NodeInput = Omit<TimelineNode, 'id' | 'sessionId' | 'timestampMs' | 'relativeTimeSec'>;

/**
 * Records and manages timeline sessions.
 * Maintains an in-memory store of active and completed sessions.
 */
export class TimelineRecorder {
  private sessions: Map<string, TimelineSession> = new Map();

  /**
   * Starts a new recording session.
   * @param templateId - The template being used for this session
   * @returns The new session's unique ID
   */
  startSession(templateId: string): string {
    const sessionId = uuid();
    const session: TimelineSession = {
      sessionId,
      templateId,
      startMs: Date.now(),
      endMs: null,
      nodes: [],
      outcome: null,
    };
    this.sessions.set(sessionId, session);
    return sessionId;
  }

  /**
   * Adds a timeline node to an active session.
   * Automatically sets id, sessionId, timestampMs, and relativeTimeSec.
   *
   * @param sessionId - The session to add the node to
   * @param partial - Node data (excluding auto-generated fields)
   * @returns The complete timeline node
   * @throws If session not found or already ended
   */
  addNode(sessionId: string, partial: NodeInput): TimelineNode {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    if (session.endMs !== null) {
      throw new Error(`Session already ended: ${sessionId}`);
    }

    const now = Date.now();
    const node: TimelineNode = {
      ...partial,
      id: uuid(),
      sessionId,
      timestampMs: now,
      relativeTimeSec: (now - session.startMs) / 1000,
    };

    session.nodes.push(node);
    return node;
  }

  /**
   * Ends a session and records its outcome.
   *
   * @param sessionId - The session to end
   * @param outcome - The trading outcome
   * @returns The completed session
   * @throws If session not found or already ended
   */
  endSession(
    sessionId: string,
    outcome: TimelineSession['outcome']
  ): TimelineSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    if (session.endMs !== null) {
      throw new Error(`Session already ended: ${sessionId}`);
    }

    session.endMs = Date.now();
    session.outcome = outcome;
    return { ...session, nodes: [...session.nodes] };
  }

  /**
   * Retrieves a session by ID.
   * @param sessionId - The session to retrieve
   * @returns The session or null if not found
   */
  getSession(sessionId: string): TimelineSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  /**
   * Exports a session as a JSON string.
   * @param sessionId - The session to export
   * @returns JSON string representation
   * @throws If session not found
   */
  exportSession(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return JSON.stringify(session, null, 2);
  }
}
