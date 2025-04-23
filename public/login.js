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
  ui.disableAutoSignIn()


/**
 * @return {string} The URL of the FirebaseUI standalone widget.
 */
function getWidgetUrl() {
  return '/widget#recaptcha=' + getRecaptchaMode() + '&emailSignInMethod=' + getEmailSignInMethod() + '&disableEmailSignUpStatus=' + getDisableSignUpStatus() + '&adminRestrictedOperationStatus=' + getAdminRestrictedOperationStatus()
}


/**
 * Redirects to the FirebaseUI widget.
 */
var signInWithRedirect = function() {
  window.location.assign(getWidgetUrl());
};

function captureAThumbnail(src, cb, name){
  let canvas = document.createElement('canvas');
  let video = document.createElement('video');
  document.body.appendChild(video);
  video.src = src;
  video.controls = true;
  video.addEventListener('loadedmetadata', function(e) {
    const midTime = e.target.duration / 2
    this.currentTime = midTime;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const addBtn = document.createElement('button');
    const preview = document.createElement('img');
    addBtn.textContent = 'Upload ' + name;
    video.addEventListener('seeked', function() {
      canvas.getContext('2d').drawImage(video, 0, 0, video.videoWidth, video.videoHeight)
      if (document.body.contains(preview)) document.body.removeChild(preview);
      if (document.body.contains(addBtn)) document.body.removeChild(addBtn);
      setTimeout(() => {
        document.body.insertBefore(preview, video);
        document.body.insertBefore(addBtn, preview);
        let data = canvas.toDataURL('image/png');
        preview.setAttribute('src', data);
        colorjs.prominent(preview, { amount: 1, format: 'hex' }).then(color => {
          addBtn.onclick = () => {
            cb(canvas, color)
            document.body.removeChild(preview);
            document.body.removeChild(video);
            document.body.removeChild(addBtn);
          }
        })
      })
    }, 500);
  });
}

/**
 * Displays the UI for a signed in user.
 * @param {!firebase.User} user
 */
var handleSignedInUser = function(user) {
  document.getElementById('user-signed-in').style.display = 'block'
  document.getElementById('user-signed-out').style.display = 'none'
  const pubButton = document.getElementById('pub')
  pubButton.onclick = function() {
    let cards = []
    const locals = Object.keys(localStorage)
    locals.forEach(key => {
      const line = key + localStorage.getItem(key)
      cards.push(line)
    })
    cards = cards.sort((a, b) => {
      if (a.startsWith("root")) {
        return -1
      }
      return 0
    })
    if (confirm("update the site with " + cards.length + " cards")) {
      const textFile = new Blob([cards.join("\n")], { type: 'text/plain' });
      const storageRef = firebase.storage().ref()
      const fileRef = storageRef.child('site/home.jsonl')
      fileRef.put(textFile).then(() => {
        alert("updated")
        fileRef.getDownloadURL().then(url => {
          console.log(url)
	})
      })
    }
  } 	
  const fileUploadElement = document.getElementById('file-upload')
  fileUploadElement.onchange = function(event) {
    [...event.target.files].forEach((file, index) => {
      const storageRef = firebase.storage().ref()
      const user = firebase.auth().currentUser
      // prepare metadata
      var metadata = {
        userId: user.uid,
        contentType: file.type
      }
      // upload file
      const fileRef = storageRef.child('userUploads/' + file.name)
      document.getElementById('uploading').style.display = 'block'
      // if image then resize image
      if (file.type.indexOf('image') !== -1) {
        const msg = {file, index, number: event.target.files.length} 
        let dotColor = ""
        const fileReader = new FileReader();
        const preview = document.getElementById('file-preview');
        fileReader.onload = event => {
          preview.setAttribute('src', event.target.result);
          colorjs.prominent(preview, { amount: 1, format: 'hex' }).then(color => {
            dotColor = color 
          })
        }
        fileReader.readAsDataURL(file);
        setTimeout(() => {
          imageResize(file, {
            type: 'png',
            bgColor: 'white',
            width: 520,
            outputType: 'blob'
            
          }).then(b => {
            const toUpload = b.size < file.size ? b : file // if resized image is bigger than original, upload original
            fileRef.put(toUpload, metadata).then(() => {
              document.getElementById('uploading').style.display = 'none'
              fileRef.getDownloadURL().then((url) => {
                window.parent.postMessage({...msg, url, dotColor})
                fileUploadElement.value = ''
              })
            }).catch(function(error) {
              console.error('Uploading image failed:', error);
            });
          })
        }, 50 + index * 200) // delay resizing & upload
      } else if (file.type.indexOf('video') !== -1) {
        const msg = {file, index, number: event.target.files.length} 
        captureAThumbnail(URL.createObjectURL(file), (canvas, color) => {
          canvas.toBlob(thumbnailBlob => {
            fileRef.put(file, metadata).then(() => {
              document.getElementById('uploading').style.display = 'none'
              fileRef.getDownloadURL().then((url) => {
                const fileRefThumbnail = storageRef.child('userUploads/' + file.name + '_thumbnail.png')

                fileRefThumbnail.put(thumbnailBlob).then(() => {
                  fileRefThumbnail.getDownloadURL().then((thumbnail) => {
                    window.parent.postMessage({...msg, url, thumbnail, color, number: event.target.files.length})
                    fileUploadElement.value = ''
                  })
                }).catch(function(error) {
                  console.error('Uploading thumbnail failed:', error);
                })
              }).catch(function(error) {
                console.error('Uploading video failed:', error);
              });
            },'image/png');
          })
        }, file.name);
      } else {
        fileRef.put(file, metadata).then(function(snapshot) {
          document.getElementById('uploading').style.display = 'none'
          fileRef.getDownloadURL().then((url) => {
            window.parent.postMessage({url, file, index, dotColor: "green", number: event.target.files.length})
            fileUploadElement.value = ''
          })
        }).catch(function(error) {
          console.error('Upload failed:', error);
        });
      }
    })
  };
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

let initApp = function() {
  document.getElementById('sign-out').addEventListener('click', function() {
    firebase.auth().signOut();
  });
  document.getElementById('delete-account').addEventListener( 'click', function() {
    deleteAccount();
  });
};

window.addEventListener('load', initApp());
