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

/**
 * FirebaseUI initialization to be used in a Single Page application context.
 */

/**
 * @return {!Object} The FirebaseUI config.
 */
function getUiConfig() {
  return {
    'callbacks': {
      // Called when the user has been successfully signed in.
      'signInSuccessWithAuthResult': function(authResult, redirectUrl) {
        if (authResult.user) {
          handleSignedInUser(authResult.user);
        }
        const isNewUser = document.getElementById('is-new-user')//to make typescript work
        if (authResult.additionalUserInfo && isNewUser !== null) {
          isNewUser.textContent =
              authResult.additionalUserInfo.isNewUser ?
              'New User' : 'Existing User';
        }
        // Do not redirect.
        return false;
      }
    },
    // Opens IDP Providers sign-in flow in a popup.
    'signInFlow': 'popup',
    'signInOptions': [
      // TODO(developer): Remove the providers you don't need for your app.
      {
        provider: firebase.auth.GoogleAuthProvider.PROVIDER_ID,
        // Required to enable ID token credentials for this provider.
        clientId: CLIENT_ID
      },
      {
        provider: firebase.auth.EmailAuthProvider.PROVIDER_ID,
        // Whether the display name should be displayed in Sign Up page.
        requireDisplayName: true,
        signInMethod: getEmailSignInMethod(),
        disableSignUp: {
          status: getDisableSignUpStatus()
        }
      },
    ],
    // Terms of service url.
    'tosUrl': 'https://www.google.com',
    // Privacy policy url.
    'privacyPolicyUrl': 'https://www.google.com',
    'credentialHelper': firebaseui.auth.CredentialHelper.NONE,
    /*'credentialHelper': CLIENT_ID && CLIENT_ID != 'YOUR_OAUTH_CLIENT_ID' ?
        firebaseui.auth.CredentialHelper.GOOGLE_YOLO :
        firebaseui.auth.CredentialHelper.NONE,*/
    'adminRestrictedOperation': {
      status: getAdminRestrictedOperationStatus()
    }
  };
}

// Initialize the FirebaseUI Widget using Firebase.
var ui = new firebaseui.auth.AuthUI(firebase.auth());
// Disable auto-sign in.
ui.disableAutoSignIn();


/**
 * @return {string} The URL of the FirebaseUI standalone widget.
 */
function getWidgetUrl() {
  return '/widget#recaptcha=' + getRecaptchaMode() + '&emailSignInMethod=' +
      getEmailSignInMethod() + '&disableEmailSignUpStatus=' +
      getDisableSignUpStatus() + '&adminRestrictedOperationStatus=' +
      getAdminRestrictedOperationStatus();
}


/**
 * Redirects to the FirebaseUI widget.
 */
var signInWithRedirect = function() {
  window.location.assign(getWidgetUrl());
};


/**
 * Open a popup with the FirebaseUI widget.
 */
var signInWithPopup = function() {
  window.open(getWidgetUrl(), 'Sign In', 'width=985,height=735');
};


/**
 * Displays the UI for a signed in user.
 * @param {!firebase.User} user
 */
var handleSignedInUser = function(user) {
  document.getElementById('user-signed-in').style.display = 'block'
  document.getElementById('user-signed-out').style.display = 'none'
  document.getElementById('name').textContent = user.displayName
  document.getElementById('email').textContent = user.email
  document.getElementById('phone').textContent = user.phoneNumber
  const fileUploadElement = document.getElementById('file-upload')
  fileUploadElement.onchange = function(event) {
    var file = event.target.files[0]
    var storageRef = firebase.storage().ref()
    var user = firebase.auth().currentUser
    // prepare metadata
    var metadata = {
     userId: user.uid,
     contentType: file.type
    }
    // upload file
    const fileRef = storageRef.child('userUploads/' + file.name)
    fileRef.put(file, metadata).then(function(snapshot) {
      fileRef.getDownloadURL().then((url) => {
	window.parent.postMessage(url)
	fileUploadElement.value = ''
      })
    }).catch(function(error) {
      console.error('Upload failed:', error);
    });
  };

     
  if (user.photoURL) {
    var photoURL = user.photoURL;
    // Append size to the photo URL for Google hosted images to avoid requesting
    // the image with its original resolution (using more bandwidth than needed)
    // when it is going to be presented in smaller size.
    if ((photoURL.indexOf('googleusercontent.com') != -1) ||
        (photoURL.indexOf('ggpht.com') != -1)) {
      photoURL = photoURL + '?sz=' +
          document.getElementById('photo').clientHeight;
    }
    document.getElementById('photo').src = photoURL;
    document.getElementById('photo').style.display = 'block';
  } else {
    document.getElementById('photo').style.display = 'none';
  }
};


/**
 * Displays the UI for a signed out user.
 */
var handleSignedOutUser = function() {
  document.getElementById('user-signed-in').style.display = 'none';
  document.getElementById('user-signed-out').style.display = 'block';
  ui.start('#firebaseui-container', getUiConfig());
};

// Listen to change in auth state so it displays the correct UI for when
// the user is signed in or not.

firebase.auth().onAuthStateChanged(function(user) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('loaded').style.display = 'block';
  user ? handleSignedInUser(user) : handleSignedOutUser();
  if (!user) return
  console.log(firebase)
  
  var storageRef = firebase.storage().ref();
  console.log(storageRef)
  var imagesRef = storageRef.child('images');
});

/**
 * Deletes the user's account.
 */
var deleteAccount = function() {
  firebase.auth().currentUser.delete().catch(function(error) {
    if (error.code == 'auth/requires-recent-login') {
      // The user's credential is too old. She needs to sign in again.
      firebase.auth().signOut().then(function() {
        // The timeout allows the message to be displayed after the UI has
        // changed to the signed out state.
        setTimeout(function() {
          alert('Please sign in again to delete your account.');
        }, 1);
      });
    }
  });
};


/**
 * Handles when the user changes the reCAPTCHA, email signInMethod or email
 * disableSignUp config.
 */
function handleConfigChange() {
  var newRecaptchaValue = document.querySelector(
      'input[name="recaptcha"]:checked').value;
  var newEmailSignInMethodValue = document.querySelector(
      'input[name="emailSignInMethod"]:checked').value;
  var currentDisableSignUpStatus =
      document.getElementById("email-disableSignUp-status").checked;
  var currentAdminRestrictedOperationStatus =
      document.getElementById("admin-restricted-operation-status").checked;
  location.replace(
      location.pathname + '#recaptcha=' + newRecaptchaValue +
      '&emailSignInMethod=' + newEmailSignInMethodValue +
      '&disableEmailSignUpStatus=' + currentDisableSignUpStatus +
      '&adminRestrictedOperationStatus=' +
      currentAdminRestrictedOperationStatus);
  // Reset the inline widget so the config changes are reflected.
  ui.reset();
  ui.start('#firebaseui-container', getUiConfig());
}


/**
 * Initializes the app.
 */
var initApp = function() {
  /*document.getElementById('sign-in-with-redirect').addEventListener(
      'click', signInWithRedirect);
  document.getElementById('sign-in-with-popup').addEventListener(
      'click', signInWithPopup);*/
  document.getElementById('sign-out').addEventListener('click', function() {
    firebase.auth().signOut();
  });
  document.getElementById('delete-account').addEventListener(
      'click', function() {
        deleteAccount();
      });
/*
  document.getElementById('recaptcha-normal').addEventListener(
      'change', handleConfigChange);
  document.getElementById('recaptcha-invisible').addEventListener(
      'change', handleConfigChange);
  // Check the selected reCAPTCHA mode.
  document.querySelector(
      'input[name="recaptcha"][value="' + getRecaptchaMode() + '"]')
      .checked = true;

  document.getElementById('email-signInMethod-password').addEventListener(
      'change', handleConfigChange);
  document.getElementById('email-signInMethod-emailLink').addEventListener(
      'change', handleConfigChange);
  // Check the selected email signInMethod mode.
  document.querySelector(
      'input[name="emailSignInMethod"][value="' + getEmailSignInMethod() + '"]')
      .checked = true;
  document.getElementById('email-disableSignUp-status').addEventListener(
      'change', handleConfigChange);
  document.getElementById("email-disableSignUp-status").checked =
      getDisableSignUpStatus();  
  document.getElementById('admin-restricted-operation-status').addEventListener(
      'change', handleConfigChange);
  document.getElementById("admin-restricted-operation-status").checked =
      getAdminRestrictedOperationStatus();  */
};

window.addEventListener('load', initApp());
