/*
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the
 * License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing permissions and
 * limitations under the License.
 */

var config = {
  apiKey: "AIzaSyCnaZyRwfSwC5lqkNiLFwhR5CGaFLLQQe4",
  authDomain: "sky-cards.firebaseapp.com",
  projectId: "sky-cards",
  storageBucket: "sky-cards.appspot.com",
  messagingSenderId: "242787438513",
  appId: "1:242787438513:web:bb5839a0a17017f93a3790"
};

if (navigator.onLine) {
  firebase.initializeApp(config);
}
  
var CLIENT_ID = '242787438513-t3btmgc0sefc6pk5v0hvccjoce97oct1.apps.googleusercontent.com';
