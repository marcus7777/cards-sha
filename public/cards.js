//import { FORMERR } from 'dns'
import { createApp, reactive } from './petite-vue.es.js'
import QrCreator from './qr-creator.es6.min.js'

console.log(reactive)
function saveCard(hash, card) {
  if (!hash) return window.alert("no hash")
  if (!card) return window.alert("no card")
  localStorage.setItem(hash, JSON.stringify(card))
}
function getUrlExtension( url ) {
  return url.split(/[#?]/)[0].split('.').pop().trim(); //this may not always work?
}
function makeHash(card) {
  if (!card) return ""
  if (typeof card === 'string') {
    return card
  }
  let obj = {...card}; //clones cards so that it can be manipulated without effecting the original let is a local variable
  delete obj.subCards; //removes a property from an object: removing the subcards from each card so that the hash won't change when adding subcards
  const str = JSON.stringify(obj);
  let hash = 0;
  if (str.length == 0) {
    return "empty000";
  }
  for (let i = 0; i < str.length; i++) {
    let char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char; // << is a bit shift
    hash = hash & hash; //ANDing them bitwise
  }
  //make the hash positive
  hash = Math.abs(hash); //makes positive by taking absolute value
  let hashAsStr = hash.toString(32); //32 bit to be easliy compressable
  //make it at least 8 characters long
  while (hashAsStr.length < 8) {
    hashAsStr = '0' + hashAsStr;
  }
  // return the hash as a string at 8 characters long
  return hashAsStr.slice(0, 8);
}
function savesToLocalStorage(file, cb) { //cb is a callback function that is called when the file is read with the first card
  const reader = new FileReader()
  reader.onload = (e) => {
    if (e.target === null || e.target.result === null || typeof e.target.result != "string") return
    const cards = e.target.result.split("\n").map(card => JSON.parse(card))
    cards.forEach(card => {
      saveCard(makeHash(card), card)
    })
    cb({ title: "title", body: "body", ...cards[0]})
  }
  reader.readAsText(file)          
}
function saveFile(text, title) { //saves the file to the local download
  const link = document.createElement("a");
  const file = new Blob([text], { type: 'text/plain' });
  link.href = URL.createObjectURL(file);
  link.download = title+".jsonl";
  link.click();
  URL.revokeObjectURL(link.href);
}
// swop the order of the cards
const store = reactive({ //updates the html immediately
  on: true,
  curser: 0,
  pageTitle: '',
  root: {
    title: '',
    color: 'white',
    cardAddtions: [],
  },
  cards: [],
  addStyleToMe(i, setTo){ // work in progress
    const elements = document.getElementsByClassName("outerMainCard")
    elements[i].style.order = setTo
  },
  hash(card){
    return makeHash(card)
  },
  showMain(card, index) {
    // look at the card and decide if it should be shown in the main list
    // trail is the path to the current card
    const topTrail = window.location.hash.slice(1).split("/").slice(0, -1)[0]
    if (!card) {
      return false
    }
    if (this.root.hideDone && card.done) {
      return false
    }
    return true
  },
  newCard: {
    title: "", 
    body: "",
    subCards: [], // array of cards
    cardAditions: [], // array of card adittions (like rel, weight, color, etc)
    done: false,
    color: '#55c2c3',
    hideDone: false,
    media: "",
    layout: "line",
    showNext: 0, // show next cards in the list (0 = all, 1 = next, 2 = next and next)
  },
  saveRoot(rootHash = "root") {
    let rootCard = {...(this.loadCard(rootHash) || this.newCard), ...this.root}
    rootCard.subCards = this.cards.map(card => makeHash(card))
    saveCard(rootHash, rootCard)
  },
  getAllHashesNeededFrom(hash) {
    let hashes = []
    let card = this.loadCard(hash)
    if (!card) {
      return []
    }
    hashes.push(hash) //push adds to
    card.subCards.forEach(subCard => {
      if (!subCard) return
      if (typeof subCard === 'string') {
        if (hashes.includes(subCard)) {
          return
        }
        hashes.push(subCard)
      }
      if (typeof subCard === "object") {
        hashes.push( makeHash(subCard) || "")
      }
      return hashes = hashes.concat(this.getAllHashesNeededFrom(subCard))
    })
    return hashes
  },
  saveToFile(root) {
    let hashes = [];
    if (typeof root === 'object') {
      hashes = this.getAllHashesNeededFrom(makeHash(root))
    } else {
      hashes = this.getAllHashesNeededFrom(root)
    }
    let cards = [];
    hashes.forEach(hash => {
      if (!hash) return
      const card = localStorage.getItem(hash)
      if (card != null) {
        cards.push(card)
      }
      
    })
    saveFile(cards.filter(card => typeof card === "string" ).join("\n"), root.title || this.pageTitle || this.title || "Sky Cards")
  },
  uploadFileInToCard(index) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.jsonl'
    input.onchange = (e) => {
      if (e.target === null) return
      const target =  e.target
      if (target.files && target.files !== null && target.files.length) {
        savesToLocalStorage(target.files[0], (card) => {
          if (index === -1) {
            this.root.subCards = this.cards[index].subCards.concat([card])
          } else {
            this.cards[index].subCards = this.cards[index].subCards.concat([card])
          }
        })
      }
    }  
    input.click()
  },
  saveToFileCloud(root) { //copied from saveToFile
    /*let hashes : string[] = [];
    if (typeof root === 'object') {
      hashes = this.getAllHashesNeededFrom(makeHash(root))
    } else {
      hashes = this.getAllHashesNeededFrom(root)
    }
    let cards : string[] = [];
    hashes.forEach(hash => {
      if (!hash) return
      const card = localStorage.getItem(hash)
      if (card != null) {
        cards.push(card)
      }
    })
    const stringToStore = cards.filter(card => typeof card === "string" ).join("\n")
    const fileName = root.title || this.  pageTitle || this.title || "Sky Cards"

    //storageRef.putString(stringToStore, fileName).then(snapshot => {*/

    /*const storageRef = firebase.storage().ref();

    document.getElementById('fileInput').addEventListener('change', event => {
    const file = event.target.files[0];
    const storageRef = firebase.storage().ref('path/to/file');
   const task = storageRef.put(file);

    task.on('state_changed', progress => {
      console.log('Upload is ' + progress.snapshot.bytesTransferred / progress.snapshot.totalBytes * 100 + '% complete');
    }, error => {
      console.log(error.message);
    }, complete => {
      console.log('Upload complete!');
    });
  });*///doesn't work
  },
  uploadFileInToCardCloud(index) {

  },
  loadCard(hash) {
    if (typeof hash === 'object') {
      hash = makeHash(hash)
    }
    if (!hash) {
      return
    }
    if (!localStorage.getItem(hash)) {
      return
    }

    const tempCard = localStorage.getItem(hash)
    if (tempCard === null) return
    let card = JSON.parse(tempCard)
    
    
    
    if (!card.subCards) {
      card.subCards = []
    }
    card.subCards = card.subCards.map(subHash => {
      if (!subHash) return
      if (typeof subHash === 'string') {
        const cardAsString = localStorage.getItem(subHash)
        if (cardAsString === null) return
        return JSON.parse(cardAsString)
      }
      return subHash
    })  
    return card
  },
  load(cardHash,newCurser) {
    // load cards from local storage
    if (!cardHash) {
      //this.trail = window.location.hash.slice(1).split("/") //this is causing the problem //useless now?
      cardHash = window.location.hash.slice(1).split("/").pop() || "root"
    } 

    const tempHashCheck = window.location.hash.slice(1).split("/").pop()
    if (tempHashCheck === undefined) return
    const fresh = tempHashCheck.indexOf(cardHash)
    
    //this.trail = this.trail.slice(0, fresh)

    const tempCard = localStorage.getItem(cardHash)
    if (tempCard === null) return
    
    let rootCard = JSON.parse(tempCard)
    if (!rootCard) {
      rootCard = {...this.newCard}
      saveCard(cardHash, rootCard)
    }
    if (!rootCard.subCards) {
      rootCard.subCards = []
    }
    this.color = rootCard.color
    this.title = rootCard.title
    this.root = {...rootCard}
    this.layout(this.root.layout)
    this.setColor()
    const subCards = rootCard.subCards.map(subHash => this.loadCard(subHash))
    // rootCard.subCards = subCards
    subCards.forEach(subCard => {
      if (!subCard) return
      if (!subCard.subCards) {
        subCard.subCards = []
      }
      const subSubCards = subCard.subCards.map(subSubHash => this.loadCard(subSubHash))
      subCard.subCards = subSubCards
    })
    this.cards = subCards
    this.curser = newCurser || 0
  },
  save() {
    // save the root card to local storage
    //this.trail = window.location.hash.slice(1).split("/") //this is causing the problem!!
    this.saveRoot(window.location.hash.slice(1).split("/").pop() || "root")
    // save this.cards to local storage hash all cards and save under the hash with a list of hashs for sub cards
    this.cards.forEach(card => {
      if (typeof card === 'string') {
        const tempCard = localStorage.getItem(card)
        if (tempCard === null) return
        card = JSON.parse(tempCard)
      }
      if (!card.subCards) {
        card.subCards = []
      }
      const subHashes = card.subCards.map(subCard => makeHash(subCard))
      card.subCards.forEach(subCard => {
        if (typeof subCard !== 'string') {
          saveCard( makeHash(subCard), subCard)

        }
      })
      const cardHash = makeHash(card)
      
      saveCard(cardHash, {...card, subCards: subHashes})
    })
  },
  shallower() {
    this.save()
    const newTrail = window.location.hash.slice(1).split("/")
    const fresh = newTrail.pop()
    window.history.pushState({}, "", "#" + newTrail.join("/"))
    this.load()
    const newCurser = this.cards.reduce((curser, card, index) => {
      if (fresh === makeHash(card)) {
        return index
      } 
      return curser
    }, -1) // imperfect solution (confuses if there is more than one card with the same hash)
    this.curser = newCurser
    this.layout(this.root.layout)
    document.title = this.root.title
  },
  deeper(newCurser) {
    this.save()
    let trail = window.location.hash.slice(1).split("/")

    const currentCard = this.cards[this.curser]
    if (!currentCard || currentCard === undefined) return
    trail.push(makeHash(currentCard))

    window.scrollTo(0, 0)
    window.history.pushState({}, "", "#" + trail.join("/"))
    document.title = this.cards[this.curser].title
    this.title = this.cards[this.curser].title
    this.color = this.cards[this.curser].color
    this.root = {...this.cards[this.curser]}

    this.setColor()

    this.cards = this.cards[this.curser].subCards.map(card => {
      card = this.loadCard(card)
      if (!card.subCards) {
        card.subCards = []
      }
      card.subCards = card.subCards.map(subCard => {
        if (typeof subCard === 'string') {
          return this.loadCard(subCard)
        }
        return subCard
      })
      return card
    })
    this.curser = newCurser
    this.layout(this.root.layout)
  },
  onEnterTitle(){
    if (!this.newCard.title) return
    else return this.inc()
    /*const addDialog = document.getElementById("mainOrSunDialog")
    addDialog.showModal()
    store.disableKeys = true*/

  },
  lastSwap: 0,
  draggingHash: "",
  dragOver(e) {
    e.preventDefault()
    if (this.lastSwap >= (Date.now() - 500)) return;
    //find the card that is being dragged over and the card that is being dragged
    const to = e.target.getAttribute("data-index")
    if (to === null) return
    const from = this.cards.reduce((index, card, currentIndex) => {
      if (makeHash(card) == this.draggingHash) {
        return currentIndex
      }
      return index
    }, -1)
    if (from === -1) return
    // TODO make sure that the swap is intened.
    if (to == from) return
    this.lastSwap = Date.now();
    this.curser = -1
    this.swapCards(from, to, false)
  },
  drop(to) {
    this.curser = to
    //this.distributeCardsCircle
  },
  resetNewCard(){
    this.newCard.title = ""
    this.newCard.media = ""
    this.newCard.body  = ""
  },
  inc() {
    //this.curser++
    //this.cards = [...this.cards.slice(0, this.curser), {...this.newCard}, ...this.cards.slice(this.curser)]
    this.curser = this.cards.length
    this.cards = [...this.cards, {...this.newCard}]
    this.resetNewCard()
    
    //closeDialog(mainOrSunDialog)
    this.save()
    setTimeout(() => {
      this.layout(this.root.layout)
    }, 100)
  },
  /*incSub() {
    let card = this.cards[this.curser]
    if (!card.subCards) {
      // check for an already existing card and load its subcards
      const cardCheck = this.loadCard(makeHash(this.newCard))
      if (cardCheck && cardCheck.subCards) {
        card.subCards = cardCheck.subCards
      } else {
        card.subCards = []
      }
    }
    if (makeHash(card) === makeHash(this.newCard)) {
      closeDialog(mainOrSunDialog)
      return alert("Don't add sub cards that are the same as the main card")
    }
    this.cards.forEach(cardCheck => {
      if (makeHash(card) === makeHash(cardCheck)) {
        cardCheck.subCards = cardCheck.subCards.concat([{...this.newCard}])
      }
    })

    // card.subCards = card.subCards.concat([{...this.newCard}])
    this.resetNewCard()
    closeDialog("mainOrSunDialog")
    this.save()
  },*/
  distributeCardsCircle() {
    console.log("distributeCardsCircle@")  
    let radius = 35;
    let cardElements = [ ...document.getElementsByClassName("outerMainCard")]
    let containers = [ ...document.getElementsByClassName("container")]
    containers.forEach(container => {
      container.classList.add("ellipse")
    })

    let angle = -Math.PI/2
    let step = (2 * Math.PI) / cardElements.length

    cardElements.forEach((card,i) => {
      const x = radius * Math.cos(angle) + 50
      const y = radius * Math.sin(angle) + 50
      // var size = (Math.round(radius * Math.sin(step))) -9
      if (i == this.curser) {
        let subCardElements = [... document.getElementsByClassName("subCard")]
        let subAngle = -Math.PI/2
        let subStep = (2 * Math.PI) / subCardElements.length
        const subRadius = 20
        subCardElements.forEach((subCard) => {
          const subX = (((subRadius * Math.cos(subAngle) + x) * 9) + 50) / 10
          const subY = (((subRadius * Math.sin(subAngle) + y) * 9) + 50) / 10

          subCard.style.left = `calc(${subX}vw - ${subCard.offsetWidth/2}px)`
          subCard.style.top = `calc(${subY}vh - ${subCard.offsetHeight/2}px)`

          subAngle += subStep
        })
      }
      
      card.style.left = `calc(${x}vw - ${card.children[0].offsetWidth/2}px)` //use vh (vi) to have a circle
      card.style.top = `calc(${y}vh - ${card.children[0].offsetHeight/2}px)`
      // card.style.transform = `rotateX(45deg) translateZ(calc(${y}vh - ${card.offsetHeight/2}px))
    
      //card.style.height = size + 'px';
      //card.style.width = size + 'px';
      //card.style.borderRadius = size / 2 + 'px';

      angle += step
    })
    
    this.save()
    let rootElement = document.getElementById("root")
    if (rootElement === null) return
    rootElement.classList.add("ellipse")
    return () => {  //clean Up
      let cardElements = [... document.getElementsByClassName("outerMainCard")]
      cardElements.forEach(function (card) {
        card.style.left = ""
        card.style.top = ""
        // card.style.transform = ""
      })
      const containers = document.getElementsByClassName("container")
      let container = containers[0]
      if (rootElement === null) return //annoyingly redundant
      rootElement.classList.remove("ellipse")
      container.classList.remove("ellipse")
    }
  },
  distributeCardsLine() {
    this.save()
    return () => {
      console.log("Clean up (does nothing) line")
    }
  },
  cleanUp() {
    console.log("Clean up (does nothing)")
  },
  layout(layout = "line") {
    this.cleanUp()
    this.root.layout = layout
    this.on = false
      
    window.requestAnimationFrame(() => {
      if (this.root.layout === "circle") {
        this.cleanUp = this.distributeCardsCircle()
      } else {
        this.cleanUp = this.distributeCardsLine()
      }
      this.on = true
    })
  },
  sortByTitle() {
    this.cards.sort((a,b) => {
      if (a.title == b.title) return 0
      if ((""+a.title == +a.title) && (""+b.title == +b.title)) { //ignore this error
        if (+a.title > +b.title) {
          return 1
        }
        return -1
      }
      if (a.title > b.title) {
        return 1
      }
      return -1
    })
    this.layout(this.root.layout)
  },
  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
    this.layout(this.root.layout)
  },
  addWeight() {

  },
  setColor() {
    //window.location.hash = window.location.hash.slice(1).split("/").pop() || ""
    //const cardToSave = this.loadCard(this.root)
    //saveCard(this.root, {...cardToSave, color: this.color})

    if (!this.root.color) {
      this.root.color = 'white'
    }
    document.body.style.backgroundColor = this.root.color
  },
  autoAdd() {
    // If the new card title end with add, then add it as a new card.
    // And select all within the text box, so you can start typing the new card title
    const triggerArray = ['. add', '. ad' , 'full stop add', 'full stop at', ". dad", "full stop next", ". Next", ". next"]
    triggerArray.forEach(trigger => {
      if (this.newCard.title.includes(trigger) && this.newCard.title.indexOf(trigger) === this.newCard.title.length - trigger.length){
        this.newCard.title = this.newCard.title.slice(0, -trigger.length)
        this.inc() 
        //document.getElementById('title').select() // this does not work on my Chromebook whilst dictating so not using it to Four now
      }
    })
    const triggerArraySub = ['. sub', 'full stop sub']
    triggerArraySub.forEach(trigger => {
      if (this.newCard.title.includes(trigger) && this.newCard.title.indexOf(trigger) === this.newCard.title.length - trigger.length){
        this.newCard.title = this.newCard.title.slice(0, -trigger.length)
        this.incSub() 
        //document.getElementById('title').select() // this does not work on my Chromebook whilst dictating so not using it to Four now
      }
    })
  },
  swapCards(index1, index2, withFocus = true) {
    
    if (this.curser === index1) {
      this.curser = index2
    } else if (this.curser === index2) {
      this.curser = index1
    }
    const swap = () => {
      const temp = this.cards[index1]
      this.cards[index1] = this.cards[index2]
      this.cards[index2] = temp
      this.cards = [...this.cards]    
      this.save()
    }
    /*if (withFocus) {
      const elements3 = document.getElementsByClassName("outerMainCard")[this.curser].getElementsByClassName("inner")
      elements3[0].focus()
    }*/
    
    //give focus to the card that was moved
    //swop the cards with a timeout so that the cards are swopped before the focus is given
    window.requestAnimationFrame(() => {
      const card1 = document.getElementsByClassName("outerMainCard")[index1]
      const card2 = document.getElementsByClassName("outerMainCard")[index2]
      // move cards towards each other
      const card1Left = card1.getBoundingClientRect().left
      const card2Left = card2.getBoundingClientRect().left
      const card1Top = card1.getBoundingClientRect().top
      const card2Top = card2.getBoundingClientRect().top
      card1.style.transform = `translate(${card2Left - card1Left + "px"}, ${card2Top - card1Top + "px"})`
      card2.style.transform = `translate(${card1Left - card2Left + "px"}, ${card1Top - card2Top + "px"})`
      this.layout(this.root.layout)
      setTimeout(() => {
        card1.style.transform = ""
        card2.style.transform = ""
        swap()
        /*if (withFocus) {
          const elements3 = document.getElementsByClassName("outerMainCard")[this.curser].getElementsByClassName("inner");
          elements3[0].focus()
        }*/
        //update card additions to include this card's weight
        const rootHash = window.location.hash.slice(1).split("/").pop() || 'root'
        let rootCard = this.loadCard(rootHash) //was a const but I changed it because it caused errors (maybe change back?)

        
        const cardAddtions = this.cards.map((card,i) => {
          return {
            weight: i, 
            cardIndex:i,
            hash: makeHash(card),
          }
        })
        this.layout(this.root.layout)
        //rootCard.cardAditions = this.mergeDown(rootCard.cardAddtions.concat(cardAddtions))
        // remove duplicate settings of the same properties in the same care
        rootCard = {...rootCard, cardAddtions}
        saveCard(rootHash, rootCard)
        this.save() 

      }, 250)
    })
  },
  makeSubCard(index1, index2) {
    if (this.curser === index1) {
      this.curser = index2
    } else if (this.curser === index2) {
      this.curser = index1
    }
    const temp = this.cards[index1]
    this.cards[index2].subCards = this.cards[index2].subCards.concat([temp])
    this.removeCard(index1)
  },
  makeMainCard(index) {
    if (!window.location.hash.slice(1).split("/")[0]) return
    // if (makeHash(...) === )// sub mail not the some)
    const temp = {...this.cards[index]}
    this.removeCard(index)
    this.save()
    this.load(["root", window.location.hash.slice(1).split("/")].slice(-2)[0]) //tidy me
    this.cards = this.cards.concat([{...temp}])
  },
  removeCard(index) {
    this.cards.splice(index, 1)
    this.curser = Math.max(0, this.curser -1)
    this.save()
    this.layout(this.root.layout)
  },
  duplicateCard(index) {
    this.curser++
    this.cards = [...this.cards.slice(0, this.curser), {...this.cards[index]}, ...this.cards.slice(this.curser)]
    this.save()
    this.layout(this.root.layout)
  },
  menuClick() {
    const addDialog = document.getElementById("menuDialog")
    store.disableKeys = true
    addDialog.showModal()
  },
  openDialog(dialog) {
    const addDialog = document.getElementById(dialog)
    store.disableKeys = true
    addDialog.showModal()
  },
  closeDialog(dialog) {
    const addDialog = document.getElementById(dialog)
    store.disableKeys = false
    addDialog.close()
  },
  endedAutoplay(card, index) {
    console.log(card, index)
    if (!card.autoplay) return
    const nextCard = this.cards[index+1]
    if (!nextCard) return
    if (!nextCard.autoplay) return
    const dataType = this.getDataType(nextCard.media)
    if (dataType == "audio" || dataType == "video") {
      const mediaCard = document.getElementsByClassName("outerMainCard")[index+1]
      console.log(mediaCard)
      mediaCard.querySelector(dataType).play()
    }
    
  },
  getDataType(url) {
    const imageFormats = ["jpeg","svg","webp","png","gif"]
    const videoFormats = ["mp4","ogg","mpeg","mov","avi","webm"]
    const audioFormats = ["mp3"]
    if (url == "") return ""
    const dataType = getUrlExtension(url)
    if (videoFormats.includes(dataType)) return "video"
    if (imageFormats.includes(dataType)) return "image"
    if (audioFormats.includes(dataType)) return "audio"
    if (url.length < 2000 && url.length > 5) return "qrCode"
    if (dataType == url) return ""
    return "image"
  },
  makeQrCode(text) {
    const div = document.createElement("div")
    QrCreator.render({ //TODO move to its own function
      text,
      radius: 0.5, // 0.0 to 0.5
      ecLevel: 'L', // L, M, Q, H
      fill: '#000',
      background: null, // color or null for transparent
      size: 150,
    }, div)
    return div.children[0].toDataURL()
  },
  log(e) { //this may be causing problems
    console.warn(e)
  },
})
function arrowKeysOn (e) {
  if(e.keyCode == 27) {
    store.disableKeys = false //introduces some awkwardness when escape is hit and then typing in a text box
    e.target.blur()
  } 
  if(store.disableKeys) return
  e = e || window.event;
  // use e.keyCode
  if(e.keyCode == 38 || e.keyCode == 87 || e.keyCode == 75) store.shallower()
  if(e.keyCode == 40 || e.keyCode == 83 || e.keyCode == 74) {
    if (store.curser == -1) store.curser = 0
    else {
      store.deeper(store.curser)
      store.curser = 0
    }
  }
  if(e.keyCode == 37 || e.keyCode == 65 || e.keyCode == 72) { //left
    if (e.shiftKey) store.swapCards(store.curser, store.curser -1)
    else store.curser =Math.max(store.curser -1,-1)
    
  }
  if(e.keyCode == 39 || e.keyCode == 68 || e.keyCode == 76) { //right
    if (e.shiftKey) store.swapCards(store.curser, store.curser +1)
    else store.curser =Math.min(store.curser +1, store.cards.length-1)
  }
  
  store.layout(store.root.layout)

}
document.onkeydown = arrowKeysOn
createApp({
  // share it with app scopes
  store,
  Card,
  UpdateDialog
}).mount()
store.load()

window.addEventListener("message", (e) => {
  if (document.getElementById("addDialog").open) {
    store.newCard.media = e.data
  } else {
    store.cards[store.curser].media = e.data
  }
})

function Card(props) {
  return {
    $template: '#card',
    card: props.card,
    displayMode: props.displayMode,
    i: props.i,
  }
}
function UpdateDialog(props) {
  return {
    $template: '#updateDialog',
    dialogName: props.dialogName,
    card: props.card,
  }
}

setInterval(() => {
  store.autoAdd()
}, 1000)
