/**
 * @license
 * Copyright 2018 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as firestore from '@firebase/firestore-types';
import { expect } from 'chai';

import { EventsAccumulator } from '../util/events_accumulator';
import firebase from '../util/firebase_export';
import { apiDescribe, withTestDb, withTestDoc } from '../util/helpers';

firebase.initializeApp({});

/**
 * Note: Transforms are tested pretty thoroughly in server_timestamp.test.ts
 * (via set, update, transactions, nested in documents, multiple transforms
 * together, etc.) and so these tests mostly focus on the array transform
 * semantics.
 */
apiDescribe('Array Transforms:', (persistence: boolean) => {
  // A document reference to read and write to.
  let docRef: firestore.DocumentReference;

  // Accumulator used to capture events during the test.
  let accumulator: EventsAccumulator<firestore.DocumentSnapshot>;

  // Listener registration for a listener maintained during the course of the
  // test.
  let unsubscribe: () => void;

  /** Writes some initialData and consumes the events generated. */
  async function writeInitialData(
    initialData: firestore.DocumentData
  ): Promise<void> {
    await docRef.set(initialData);
    await accumulator.awaitLocalEvent();
    const snapshot = await accumulator.awaitRemoteEvent();
    expect(snapshot.data()).to.deep.equal(initialData);
  }

  async function expectLocalAndRemoteEvent(
    expected: firestore.DocumentData
  ): Promise<void> {
    const localSnap = await accumulator.awaitLocalEvent();
    expect(localSnap.data()).to.deep.equal(expected);
    const remoteSnap = await accumulator.awaitRemoteEvent();
    expect(remoteSnap.data()).to.deep.equal(expected);
  }

  /**
   * Wraps a test, getting a docRef and event accumulator, and cleaning them
   * up when done.
   */
  async function withTestSetup<T>(test: () => Promise<T>): Promise<void> {
    await withTestDoc(persistence, async doc => {
      docRef = doc;
      accumulator = new EventsAccumulator<firestore.DocumentSnapshot>();
      unsubscribe = docRef.onSnapshot(
        { includeMetadataChanges: true },
        accumulator.storeEvent
      );

      // wait for initial null snapshot to avoid potential races.
      const snapshot = await accumulator.awaitRemoteEvent();
      expect(snapshot.exists).to.be.false;
      await test();
      unsubscribe();
    });
  }

  it('create document with arrayUnion()', async () => {
    await withTestSetup(async () => {
      await docRef.set({
        array: firebase.firestore!.FieldValue.arrayUnion(1, 2)
      });
      await expectLocalAndRemoteEvent({ array: [1, 2] });
    });
  });
});
