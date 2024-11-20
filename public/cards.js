import { createApp, reactive } from './petite-vue.es.js'
import QrCreator from './qr-creator.es6.min.js'

const cardTemplate = {
  title: "", 
  body: "",
  smBody: "",
  source: "",       // url if from the web only save updates under the hash of the generated card 
  subCards: [],     // array of cards
  toDoFirst: [],    // array of cards that need to be before this card
  done: false,
  color: '', // dot color and background color of the page
  hideDone: false,
  media: "",
  autoplay: false,  
  quickAdd: false,
  thumbnail: "", // thumbnail for the media just video for now
  layout: "line", // line, circle, grid
  slice: 0,
  onlyShowDone: false,
  onlyShowNotDone: false,
  onlyShowDoable: false,
  noEditing: false,
  lockPosition: false,
  mix: false,
  doneOn: [], // list of dates
  madeOn: "", // date
  fav: false, // favorite
}

function UpdateDialog(props) {
  return {
    $template: '#updateDialog',
    dialogName: props.dialogName,
    card: props.card,
  }
}
function diff(obj1, obj2) { 
  var ret = {}; 
  for(var i in obj2) { 
    if(!obj1.hasOwnProperty(i) || obj2[i] !== obj1[i] || typeof obj2[i] === 'object') {
      if (Array.isArray(obj2[i]) && Array.isArray(obj1[i])) {
        if (obj2[i].length !== obj1[i].length) {
          ret[i] = obj2[i]
        }
        if (obj2[i].length === obj1[i].length) { // if the arrays are the same length
          if (!obj2[i].every((val, index) => val === obj1[i][index])) { // if the arrays are not the same
            ret[i] = obj2[i]
          }
          if (!obj2[i].length) continue // both arrays are empty
        }
        continue
      }
      ret[i] = obj2[i]; 
    } 
  } 
  return ret; 
}; 
function saveCard(hash, card) {
  // save the diffrance between the card and generated card or template card

  if (!hash) return // window.alert("no hash")
  if (!card) return // window.alert("no card")
  if (!memCards[hash]) {
    const toSave = diff(cardTemplate, card)
    if (Object.keys(toSave).length === 0) return localStorage.removeItem(hash)
    return localStorage.setItem(hash, JSON.stringify(toSave))
  }
  if (typeof memCards[hash] === 'object') {
    let toSave = diff({...cardTemplate, ...memCards[hash]}, card)
    if (card.lockPosition) {
      delete toSave.subCards
    }
    if (Object.keys(toSave).length === 0) return localStorage.removeItem(hash)
    return localStorage.setItem(hash, JSON.stringify(toSave))
  }
  if (typeof memCards[hash] === 'string') {
    console.log("memCards[hash] save", memCards[hash])
  }
}
function getUrlExtension( url ) {
  if (!url) return ""
  return url.split(/[#?]/)[0].split('.').pop().trim(); //may not always work?
}
function makeHash(card) {
  if (!card) return ""
  if (typeof card === 'string') {
    return card
  }
  let obj = {...cardTemplate, ...card}; //clones cards so that it can be manipulated without effecting the original let is a local variable
  delete obj.subCards; // removing the subcards from each card so that the hash won't change when adding subcards
  delete obj.doneOn; // removing the doneOn from each card so that the hash won't change when adding doneOn
  delete obj.done; // removing the done from each card so that the hash won't change when adding done
  delete obj.fav; // removing the fav from each card so that the hash won't change when adding fav

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
let memCards = {} // memory cards save fetchable cards (immutable)

function fetchCards(url, hash, cb = () => {}) {
  if (!memCards[hash]) { // if the card is not in memory
    memCards[hash] = {} // prevent multiple fetches
    // if jsonl fetch the cards
    if (url.indexOf(".jsonl") !== -1) {
      fetch(url).then(response => response.text()).then(text => {
        const lines = text.split("\n")
        const cards = lines.filter(card => card.indexOf("}") !== -1).map(card => JSON.parse(card))
        const forwords = lines.filter(card => card.indexOf("}") === -1)
        if (forwords.length) {
          console.log("Forwords", forwords)
        }
        console.log("cards", cards)
        const firstCard = cards[0]
        memCards[hash] = makeHash(firstCard)
        cards.forEach(card => {
          memCards[makeHash(card)] = card
        })
        cb(firstCard)
      })  
    } else {
      fetch(url).then(response => response.text()).then(text => { // if xml/rss fetch the cards
        const doc = new window.DOMParser().parseFromString(text, "text/xml")
        // make card and subcards
        if (doc.querySelectorAll("rss > channel > image > url")[0]) { // if the rss has an image
          const media = doc.querySelectorAll("rss > channel > image > url")[0].textContent
          const title = doc.querySelectorAll("rss > channel > title")[0].textContent
          const body = doc.querySelectorAll("rss > channel > description")[0].textContent
          const items = doc.querySelectorAll("rss > channel > item")
          let subHashes = []
          const subCards = Array.from(items).map(item => {
            const title = item.querySelectorAll("title")[0].textContent
            const media = item.querySelectorAll("enclosure")[0].getAttribute("url")
            const body = item.querySelectorAll("description")[0].textContent
            const link = item.querySelectorAll("link")[0].textContent
            const card = {...cardTemplate, title, media, body, link}
            const subHash = makeHash(card)
            subHashes.push(subHash)
            memCards[subHash] = card
            return card
          })
          const make = { ...cardTemplate, title, body,
            media, subCards: subHashes, source: url,
            onlyShowNotDone: true, slice: -3,
            lockPosition: true,
          }
          memCards[hash] = make // Do be combined with card of hash
          cb(make)
          console.log("cards loaded", memCards[hash])
        } else {
          // put the cards in page
          console.log("doc", doc)
        }
      })
   }
  }
  return { ...cardTemplate, title: "Loading", body: "Loading", color: "#888", hash: hash}
}

function savesToLocalStorage(file, cb) { //cb is a callback function that is called when the file is read with the first card
  const reader = new FileReader()
  reader.onload = (e) => {
    if (e.target === null || e.target.result === null || typeof e.target.result != "string" || !e.target.result) return alert("No file or file is empty")
    const lines = e.target.result.split("\n")
    const cards = lines.filter(card => card.indexOf("}") !== -1).map(card => JSON.parse(card))
    cards.forEach(card => {
      saveCard(makeHash(card), card)
    })
    const forwords = lines.filter(card => card.indexOf("}") === -1)
    if (forwords.length) {
      console.log("Forwords", forwords)
    }

    alert(" Got " + cards.length + " cards")
    cb({ ...cardTemplate, ...cards[0]})
  }
  reader.readAsText(file)          
}
function saveFile(text, title) { //saves the file to the local download
  const link = document.createElement("a");
  const file = new Blob([text], { type: 'text/plain' });
  link.href = URL.createObjectURL(file);
  link.download = title + ".jsonl";
  link.click();
  URL.revokeObjectURL(link.href);
}
// swop the order of the cards
const store = reactive({ //updates the html immediately
  curser: 0,
  pageTitle: '',
  editing: false,
  root: {
    title: '',
    color: 'white',
    layout: "line",
    slice: 0,
    onlyShowDone: false,
    onlyShowNotDone: false,
    onlyShowDoable: false,
    mix: false,
    quickAdd: false,
    noEditing: false,
    lockPosition: false,
  },
  draggingSub: false,
  cards: [],
  makeRoot: (hash) => {
    console.log("Making root", hash)
    localStorage.setItem("root", localStorage.getItem(hash))
    //reload page
    window.location.reload()
  },
  displayedCards: () => {
    let cards = store.displayedSubCards({...store.root, subCards: store.cards})
    store.currentlyDisplayCards = cards
    return cards
  },
  displayedSubCards: (ofCard) => {
    ofCard = {...cardTemplate, ...ofCard}
    let cards = ofCard.subCards.map((card, index) => ({...card, index}))
    if (!ofCard.onlyShowDone && !ofCard.onlyShowNotDone && !ofCard.onlyShowDoable && !+ofCard.slice && !ofCard.mix) {
      return cards
    }
    if (ofCard.mix) {
      for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
      }
    }
    cards = cards.filter((card, index) => {
      if (!card) return false
      if (ofCard.onlyShowDone && !card.done) {
        return false
      }
      if (ofCard.onlyShowNotDone && card.done) {
        return false
      }
      if (ofCard.onlyShowDoable) {
        // load the array of cards that need to be done first and see if they are all done
        if (card.toDoFirst && card.toDoFirst.length) {
          if (!card.toDoFirst.every(hash => store.loadCard(hash).done)) {
            return false
          }
        }
      }
      return true
    }).reverse().slice(+ofCard.slice).reverse()
    return cards
  },
  
  clearLocalStore() {
    window.localStorage.clear()
    window.location.reload()
  },
  hash(card){
    return makeHash(card)
  },
  big: false,
  toggleBig(){
    this.big = !this.big
  },
  newCard: {...cardTemplate},
  currentlyDisplayCards: [],
  loadMemPath() {
    const path = ["root", ...window.location.hash.slice(1).split("/")]
    console.log("Loading path", path)
    for (let i = 0; i < path.length; i++) {
      if (path[i] !== "") {
        let card = this.loadCard(path[i])
        if (card && card.source) {
          this.loading = true
          const loading = setInterval(() => {
            this.loading = true
            if (Object.keys(memCards).length !== 0) {
              this.loading = false
              clearTimeout(loading)
            }
          }, 200)
        }
      }
    }
  },
  saveRoot(rootHash = "root") {
    console.log("Saving root")
    let rootCard = {...(this.loadCard(rootHash) || this.newCard), ...this.root}
    rootCard.subCards = this.cards.map(card => makeHash(card))
    if (!rootCard.title && !rootCard.source) return console.log("No title or source", rootCard, rootHash)
    if ( rootCard.title &&  rootCard.source) return console.log("title and source", rootCard)
    const newHash = makeHash(rootCard)
    if (newHash !== rootHash) {
      console.log("new root", newHash, rootHash)
      if (localStorage[newHash]) {
        localStorage.setItem(rootHash, newHash)
      }
    }
    saveCard(newHash, rootCard)
  },
  getAllHashesNeededFrom(hash) {
    let card = {}
    if (typeof hash === 'object') {
      hash = makeHash(hash)
      card = hash
    }
    if (typeof hash === 'string') {
      card = this.loadCard(hash)
    }
    let hashes = []
    card = this.loadCard(hash)
    if (!card) {
      return []
    }
    hashes.push(hash) // push adds to
    let needsSaving = false
    card.subCards.forEach((subCard, i) => {
      if (!subCard) return
      if (typeof subCard === 'string') {
        if (hashes.includes(subCard)) {
          return
        }
        const testHash = makeHash(this.loadCard(subCard))
        if (testHash === subCard) {
          hashes.push(subCard)
        } else {
          card.subCards[i] = testHash
          needsSaving = true
        }
      }
      if (typeof subCard === "object") {
        hashes.push( makeHash(subCard) || "")
      }
      return hashes = hashes.concat(this.getAllHashesNeededFrom(subCard))
    })
    if (needsSaving) {
      saveCard(hash, card)
    }
    return [...new Set(hashes)]
  },
  addMain(hash) {
    this.cards = [ ...this.cards, this.loadCard(hash)]
    this.save()
  },
  addSubCardsFrom(hash) {
    const card = this.loadCard(hash)
    if (!card) return
    this.cards = this.cards.concat(card.subCards.map(subCard => this.loadCard(subCard)))
    this.save()
  },
  removeCardLocal(hash) {
    localStorage.removeItem(hash)
  },
  localCards() {
    return Object.keys(localStorage).filter(key => localStorage[key].indexOf("}") !== -1).sort((a, b) => {
      return store.getAllHashesNeededFrom(b).length - store.getAllHashesNeededFrom(a).length
    }).map(key => {
      return {...this.loadCard(key), key}
    })
  },
  listedByCards(hash){
    return Object.keys(localStorage).reduce((acc, key) => {
      const card = this.loadCard(key)
      if (!card) return acc
      if (card.subCards && card.subCards.map(c => makeHash(c)).includes(hash)) {
        return acc + 1
      }
      return acc
    }, 0)
  },
  listOrphanedCards() {
    let mostChildren = 0

    const topcard = this.findOrphanedCards().reduce((acc, hash) => {
      const children = this.getAllHashesNeededFrom(hash)
      if (children.length > mostChildren) {
        mostChildren = children.length
        return hash
      }
      return acc
    }, "root")

    return this.loadCard(topcard)
  },
  findOrphanedCards() {
    let rootHash = window.location.hash.slice(1).split("/").pop() || "root"
    let rootCard = this.loadCard(rootHash)
    let allHashes = this.getAllHashesNeededFrom(rootHash)
    let orphanedCards = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key === null) continue
      if (key === "root") continue
      if (key === rootHash) continue
      if (!allHashes.includes(key)) {
        orphanedCards.push(key)
      }
    }
    return orphanedCards
  },
  replaceForwordsFor(hash) {
    // replace forwords with the card they are pointing to in sub cards
    const card = this.loadCard(hash)
    if (!card) return
    card.subCards = card.subCards.map(subCard => {
      if (typeof subCard === 'string') {
        return this.loadCard(subCard)
      }
      return subCard
    }).filter(card => !!card).map(card => makeHash(card))
    if (hash !== makeHash(card)) {
      saveCard(makeHash(card), card)
    }
    return JSON.stringify(card)
  },
  saveToFile(root) {
    let hashes = []
    if (typeof root === 'object') {
      hashes = this.getAllHashesNeededFrom(makeHash(root))
    } else {
      hashes = this.getAllHashesNeededFrom(root)
    }
    let cards = []
    hashes.forEach(hash => {
      if (!hash) return
      const card = localStorage.getItem(hash)
      if (card == null) return console.log(hash + " not found")
      // if the card is a forword card we need to save the hash and the hash it is pointing to
      if (card.indexOf("}") === -1) { //this is not a card but a forword
        console.log("Forword card", card)
        console.log("saving ", hash + card)
        if (hash === "root") return cards.push(JSON.stringify(this.loadCard(card)))
        return cards.push(hash + card)
      }
      cards.push(card)
    })
    const name = this.root.title || this.pageTitle || this.title || "Sky Cards"
    saveFile(cards.filter(card => typeof card === "string" ).join("\n"), name + " " + cards.length + " cards")

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
          if (index === "root" || index == -1) {
            this.root = {...cardTemplate, ...card}
            this.cards = [].concat(card.subCards).map(subCard => this.loadCard(subCard)).filter(card => !!card)
            this.curser = 0
            
          } else {
//            this.cards[index] = {...cardTemplate, ...card}
            this.cards[index].subCards = (this.cards[index].subCards || []).concat([card])
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
    const fileName = root.title || this.pageTitle || this.title || "Sky Cards"

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
  loadCard(hash, cb = () => {}) { // returns the card with subcards as hashes
    if (typeof hash === 'object') {
      hash = makeHash(hash)
    }
    if (!hash || hash === "" || hash.length > 8) {
      return
    }
    if (!localStorage.getItem(hash) && !memCards[hash]) {
      return console.log("No card found", hash)
    }

    const tempCard = localStorage.getItem(hash) // get the card from local storage
    
    if (tempCard === null && memCards[hash]) {
      let cardFormMem = {}
      if (typeof memCards[hash] === 'object') {
        cardFormMem = { ...cardTemplate, ...memCards[hash]}
        cardFormMem.subCards = cardFormMem.subCards.map(sub => {
          if (typeof sub === 'object') {
            return sub
          }
          if (typeof sub === 'string') {
            if (sub === hash) return console.log("Circular reference", hash)
            return this.loadCard(sub)
          }
          console.log("Not a card", sub)
          return false
        }).filter(card => !!card)
      }
      cb(cardFormMem)
      return cardFormMem
    }
    if (tempCard === null) return alert("No card found") // if the card is not found return an alert
    if (tempCard.indexOf("}") === -1) { // not JSON
      if (tempCard.length === 8 && tempCard.indexOf(hash) === -1) return this.loadCard(tempCard, cb) // forword
      if (tempCard.length === 16 && tempCard.indexOf(hash) === -1) {
        return {...this.loadCard(tempCard.slice(0, 8)), ...this.loadCard(tempCard.slice(0, 8))} // Combine
      }
      if (tempCard.length % 8 === 0 && tempCard.indexOf(hash) === -1) return this.loadCard(tempCard.slice(0,16)) // TODO 
      return alert("Not a card " + tempCard)
    }

    let card = { ...cardTemplate, ...JSON.parse(tempCard)} 
    if (card.source) {
      if (!memCards[hash]) {
        fetchCards(card.source, hash, (loaded) => {
          const newCard = {...card, ...loaded}
          if (!newCard.title) {
            console.log("No title on loaded card", newCard)
            return
          }
          // saveCard(newHash, newCard)
  
          memCards[hash] = newCard

          cb(newCard)

          console.log("loaded...", newCard, hash, card)
        })
      } else if (Object.keys(memCards[hash]).length) { // conbine the cards
        // const subCards = memCards[hash].subCards
        card = {...memCards[hash], ...diff(cardTemplate, card)}
      }
    }
    card.subCards = card.subCards.map(subHash => {
      if (hash === subHash) {
        console.log("Circular reference", hash)
        return false
      }
      return subHash
    }).filter(card => !!card)
    cb(card)
    return card
  },
  load(cardHash, newCurser) {
    // load cards from local storage
    if (!cardHash) {
      cardHash = window.location.hash.slice(1).split("/").pop() || "root"
    } 

    this.loadCard(cardHash, (card) => {
      if (!card) {
        if (cardHash === "root") {
          alert("No root card found")
          // load default root card 
        }
        return console.log("No card found", cardHash)
      }

      if (!card.subCards) {
        card.subCards = []
      }

      this.color = card.color
      this.title = card.title
      this.root = { ...cardTemplate, ...card} // load the root card
      const subCards = card.subCards.map(subHash => this.loadCard(subHash, subCard => { // load main cards
        if (!subCard) return
        const subSubCards = subCard.subCards.map(subSubHash => this.loadCard(subSubHash)) // load sub cards
        this.cards.push({...subCard, subCards: subSubCards})
      }))
      this.layout(this.root.layout)
      this.setColor()
      this.curser = newCurser || 0
    })
  },
  save() {
    console.log("Saving")
    // save the root card to local storage
    //this.trail = window.location.hash.slice(1).split("/") //this is causing the problem!!
    this.saveRoot(window.location.hash.slice(1).split("/").pop() || "root")
    // save this.cards to local storage hash all cards and save under the hash with a list of hashs for sub cards
    this.cards.forEach(card => {
      if (!card) return console.log("No card")
      if (typeof card === 'string') {
        card = this.loadCard(card)
      }
      const subHashes = card.subCards.map(subCard => makeHash(subCard)).filter(hash => !!hash)
      card.subCards.forEach(subCard => {
        if (typeof subCard !== 'string' && subCard !== null && subCard !== undefined) { 
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

    const currentCard = this.cards[this.curser] // this is the card that is being drilled into
    if (!currentCard || currentCard === undefined) return // if null or undefined stop the function
    trail.push(makeHash(currentCard))

    window.scrollTo(0, 0)
    window.history.pushState({}, "", "#" + trail.join("/"))
    document.title = this.cards[this.curser].title
    this.title = this.cards[this.curser].title
    this.color = this.cards[this.curser].color
    this.root = {...cardTemplate, ...this.cards[this.curser]}

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
    if (to == -1) {
      this.makeMainCard(from)
    } else {
      this.lastSwap = Date.now();
      this.swapCards(from, to, false)
    }
  },
  drop(to) {
    if (this.lastSwap >= (Date.now() - 500)) return;
    console.log("drop", to)
    if (this.draggingSub) {
      this.draggingSub = false
      console.log(this.curser)
      // find sub card
      const from = this.cards[this.curser].subCards.reduce((index, card, currentIndex) => {
        if (makeHash(card) == this.draggingHash) {
          return currentIndex
        }
        return index
      }, -1)
      const theCard = this.cards[this.curser].subCards[from]
      // delete this.cards[this.curser].subCards[from]

      if (to === -1) { //move to sub card
        this.cards = [...this.cards.map((card, i) => {
          if (i === this.curser) {
            return {...card, subCards: card.subCards.filter((subCard, j) => j !== from)}
          }
          return card
        }), {...theCard}]
      } else {
        this.cards = [...this.cards.map((card, i) => {
          if (i === to) {
            return {...card, subCards: card.subCards.concat([{...theCard}])}
          }
          if (i === this.curser) {
            return {...card, subCards: card.subCards.filter((subCard, j) => j !== from)}
          }
          return card
        })]
      }
      this.layout(this.root.layout)
      this.save()
      // remove old card
    }
    this.curser = to
    //this.distributeCardsCircle
  },
  dropToDup(e) {
    e.preventDefault()
    if (this.lastSwap >= (Date.now() - 500)) return;
    const theCard = this.cards.reduce((acc, card) => {
      if (makeHash(card) == this.draggingHash) {
        return card
      }
      // look in sub cards
      return card.subCards.reduce((acc, subCard, currentIndex) => {
        if (makeHash(subCard) == this.draggingHash) {
          return subCard
        }
        return acc
      }, acc)
    }, this.root)
    if (theCard === null) return
    this.cards = [...this.cards, {...theCard}]
    this.layout(this.root.layout)
    this.save()
  },
  resetNewCard(){
    this.newCard.title    = ""
    this.newCard.source   = ""
    this.newCard.media    = ""
    this.newCard.body     = ""
    this.newCard.smBody   = ""
    this.newCard.color    = ''
    this.newCard.hideDone = false
    this.newCard.subCards = []
    this.newCard.done     = false
    this.newCard.layout   = "line"
    this.newCard.slice    = 0
    this.newCard.onlyShowDone = false
    this.newCard.onlyShowNotDone = false
    this.newCard.onlyShowDoable = false
    this.newCard.mix      = false
    this.newCard.doneOn   = []
    this.newCard.madeOn   = ""
    this.newCard.toDoFirst = []
    this.newCard.quickAdd = false
    this.newCard.autoplay = false
    this.newCard.thumbnail = ""
    this.newCard.noEditing = false
    this.newCard.lockPosition = false
  },
  inc() {
    this.curser = this.cards.length
    this.cards = [...this.cards, {...this.newCard}]
    this.resetNewCard()
    
    //closeDialog(mainOrSunDialog)
    this.save()
    setTimeout(() => {
      this.layout(this.root.layout)
    }, 100)
  },
  incSub() {
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
  },
  distributeCardsCircle() {
    let radius = 35;
    let cardElements = [ ...document.getElementsByClassName("outerMainCard")]
    let containers = [ ...document.getElementsByClassName("container")]
    containers.forEach(container => {
      container.classList.add("ellipse")
    })

    let step = (2 * Math.PI) / cardElements.length
    let angle = -Math.PI/2 + (step/2)

    cardElements.forEach((card,i) => {

      const x = radius * Math.cos(angle) + 50
      const y = radius * Math.sin(angle) + 50
      // var size = (Math.round(radius * Math.sin(step))) -9

      if (card.dataset.index == this.curser) {
        let subCardElements = [... document.getElementsByClassName("subCard")]
        let subStep = (2 * Math.PI) / subCardElements.length
        let subAngle = -Math.PI/2 + (subStep/2)
        const subRadius = 20
        subCardElements.forEach((subCard) => {
          const subX = (((subRadius * Math.cos(subAngle) + x) * 5) + 50) / 10
          const subY = (((subRadius * Math.sin(subAngle) + y) * 5) + 50) / 10
          // if on the right side of the circle, move the card to the left
          if ((Math.cos(subAngle) > 0)) { // if the angle is positive
            subCard.style.left = `calc(${subX}vw - ${subCard.offsetWidth/2}px + ${card.children[0].offsetWidth * 0.5}px)`
          } else {
            subCard.style.left = `calc(${subX}vw - ${subCard.offsetWidth/2}px)`
          }
          subCard.style.top = `calc(${subY}vh - ${subCard.offsetHeight/2}px)`

          subAngle += subStep
        })
      }
      
      card.style.left = `calc(${x}vw - ${card.offsetWidth/2}px)` //use vh (vi) to have a circle
      card.style.top = `calc(${y}vh - ${card.offsetHeight/2}px)`
      // card.style.transform = `rotateX(45deg) translateZ(calc(${y}vh - ${card.offsetHeight/2}px))
    
      //card.style.height = size + 'px';
      //card.style.width = size + 'px';
      //card.style.borderRadius = size / 2 + 'px';

      angle += step
    })
    
    this.save()
    this.colorDots()
    let rootElement = document.getElementById("root")
    if (rootElement === null) return
    rootElement.classList.add("ellipse")
    return () => {  //clean Up
      let cardElements = [... document.getElementsByClassName("outerMainCard")]
      cardElements.forEach((card, i) => {
        if (!this.cards[i]) return
        card.style.left = ""
        card.style.top = ""
        // card.style.transform = ""
      })
      if (rootElement === null) return //annoyingly redundant
      rootElement.classList.remove("ellipse")
      let containers = [ ...document.getElementsByClassName("container")]
      containers.forEach(container => {
        container.classList.remove("ellipse")
      })
    }
  },
  distributeCardsLine() {
    this.save()
    this.colorDots()
    return () => {
    }
  },
  colorDots() {
    let rootElement = document.getElementById("root")
    const dot = rootElement.getElementsByClassName("dot")[0] 
    dot.style.backgroundColor = this.root.color
    if (rootElement === null) return
    let cardElements = [ ...document.getElementsByClassName("outerMainCard"), ...document.getElementsByClassName("subCard")]
    cardElements.forEach(card => {
      const color = card.dataset.color
      if (!color) return console.log("No color")
      const dot = card.getElementsByClassName("dot")[0] 
      if (!dot || dot === null) return
      dot.style.backgroundColor = color
    })
  },
  distributeCardsGrid() {
    this.save()
    this.colorDots()
    const rootElement = document.getElementById("root")
    rootElement.classList.add("grid")
    const containers = [ ...document.getElementsByClassName("container")]
    containers.forEach(container => {
      container.classList.add("grid")
    })
    
    return () => {
      rootElement.classList.remove("grid")
      containers.forEach(container => {
        container.classList.remove("grid")
      })
    }
  },
  cleanUp() {
    // console.log("Clean up (does nothing)")
  },
  layout(layout = "line") {
    this.cleanUp()
    this.root.layout = layout
      
    window.requestAnimationFrame(() => {
      if (this.root.layout === "circle") {
        this.cleanUp = this.distributeCardsCircle()
      } else if (this.root.layout === "line"){
        this.cleanUp = this.distributeCardsLine()
      } else if (this.root.layout === "grid") {
        this.cleanUp = this.distributeCardsGrid()
      } else {
        this.cleanUp = () => {}
      }
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
  markAllDone() {
    this.cards = this.cards.map(card => ({...card, done: true, doneOn: [...(card.doneOn || []),new Date().toISOString()]}))
    this.layout(this.root.layout)
    this.save()
  },
  markAllNotDone() {
    this.cards = this.cards.map(card => ({...card, done: false}))
    this.layout(this.root.layout)
    this.save()
  },
  removeAllDone() {
    this.cards = this.cards.filter(card => !card.done)
    this.layout(this.root.layout)
    this.save()
  },
  setColor() {
    if (!this.root.color) return
    document.body.style.backgroundColor = this.root.color
  },
  autoAdd() {
    // If the new card title end with add, then add it as a new card.
    // And select all within the text box, so you can start typing the new card title
    const triggerArray = ['.', '. ' , 'full stop', 'full stop ']
    triggerArray.forEach(trigger => {
      if (this.newCard.title.includes(trigger) && this.newCard.title.indexOf(trigger) === this.newCard.title.length - trigger.length){
        this.newCard.title = this.newCard.title.slice(0, -trigger.length)
        this.inc() 
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

        
        this.layout(this.root.layout)
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
  dragOverSub(to) { //drag over the sub cards
    if (to === null) return
    if (this.lastSwap >= (Date.now() - 500)) return;
    console.log("drag over sub",to)
    //find the card that is being dragged over and the card that is being dragged
    const from = this.cards.reduce((index, card, currentIndex) => {
      if (makeHash(card) == this.draggingHash) {
        return currentIndex
      }
      return index
    }, -1)
    if (from === -1) return
    // TODO make sure that the swap is intened.
    if (to == from) return
    if (to === -1) {
      this.makeMainCard(from)
    } else {
      this.lastSwap = Date.now()
      this.makeSubCard(from, to)
      
    }
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
    store.editing = true
    store.disableKeys = true
    window.requestAnimationFrame(() => {
      const addDialog = document.getElementById(dialog)
      console.log("addDialog", dialog, addDialog)
      addDialog.showModal()
    })
  },
  closeDialog(dialog) {
    const addDialog = document.getElementById(dialog)
    store.disableKeys = false
    addDialog.close()
    store.editing = false
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
    const imageFormats = ["jpg", "jpeg","svg","webp","png","gif"]
    const videoFormats = ["mp4","ogg","mpeg","mov","avi","webm"]
    const audioFormats = ["mp3", "wav", "ogg", "m4a", "flac", "aac"]
    if (!url) return ""
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
})
function arrowKeysOn (e) {
  if (e.keyCode == 27) {
    store.disableKeys = false //introduces some awkwardness when escape is hit and then typing in a text box
    e.target.blur()
  } 
  if (store.disableKeys) return
  e = e || window.event;
  const currentIndex = store.currentlyDisplayCards.map(card => card.index)
  // use e.keyCode
  if (e.keyCode == 38 || e.keyCode == 87 || e.keyCode == 75) store.shallower()
  if (e.keyCode == 40 || e.keyCode == 83 || e.keyCode == 74 || e.keyCode == 13) {
    if (store.curser == -1) store.curser = 0
    else {
      store.deeper(0)
    }
  }
  if (e.keyCode == 37 || e.keyCode == 65 || e.keyCode == 72) { //left
    if (e.shiftKey) {
      store.swapCards(currentIndex[store.curser], currentIndex[store.curser -1])
    } else {
      store.curser = Math.max(currentIndex[store.curser -1],-1)
    }
  }
  if (e.keyCode == 39 || e.keyCode == 68 || e.keyCode == 76) { //right
    if (e.shiftKey) {
      store.swapCards(currentIndex[store.curser], currentIndex[store.curser + 1])
    } else { 
      store.curser = Math.min(store.curser + 1, store.currentlyDisplayCards.length - 1)
    }
  }
  if (e.keyCode == 43) store.openDialog('addDialog') // plus
  if (e.keyCode == 45 && confirm("Delete Card?")) store.removeCard(store.curser) // minus
  store.big = false
  store.layout(store.root.layout)

}
document.onkeydown = arrowKeysOn
createApp({
  // share it with app scopes
  store,
  UpdateDialog,
}).mount()
// store.loadMemPath()
store.load()
setTimeout(() => {
  document.title = store.root.title
  document.body.style.display = "block"
}, 200)
window.onhashchange = function(e) {
  console.log("hash change", e)
  store.load()
}

window.addEventListener("message", (e) => {
  if (document.getElementById("addDialog").open || e.data.number != 1) {
    if (e.data.file.type.indexOf('image') !== -1) {
      if (store.getDataType(store.newCard.media) === "video") {
        return store.newCard.thumbnail = e.data.url
      }
    }
    if (store.getDataType(e.data.url) === "video") {
      store.newCard.media = e.data.url
    }
    if (store.getDataType(e.data.url) === "image") {
      store.newCard.media = e.data.url
    }
    if (store.getDataType(e.data.url) === "audio") {
      store.newCard.media = e.data.url
    }
    console.log("deck title",e.data.file, store.newCard)
    if (e.data.file && !store.newCard.title) {
      const dataType = getUrlExtension(e.data.file.name)
      store.newCard.title = e.data.file.name.replace("." + dataType, "")
    }
    if (!store.newCard.color) {
      store.newCard.color = e.data.dotColor
    }
    if (e.data.number > 1) { // auto add
      console.log("auto add", e.data.index)
      const dataType = getUrlExtension(e.data.file.name)
      store.newCard.title = e.data.file.name.replace("." + dataType, "")
      store.cards = [...store.cards, {...store.newCard}]
      console.log([...store.cards])
      store.save()
      store.resetNewCard()
      store.layout(store.root.layout)
    }
  } else {
    if (store.getDataType(e.data.url) === "image") {
      if (store.getDataType(store.root.media) === "video" || store.getDataType(store.root.media) === "audio"){
        return store.root.thumbnail = e.data.url
      }
    }
    if (store.getDataType(e.data.url) === "video") {
      store.root.media = e.data.url
    }
    if (store.getDataType(e.data.url) === "image") {
      store.root.media = e.data.url
    }
    if (store.getDataType(e.data.url) === "audio") {
      store.root.media = e.data.url
    }
    if (e.data.file && !store.root.title) {
      console.log(e.data.file)
      
      const dataType = getUrlExtension(e.data.file.name)
      store.root.title = e.data.file.name.replace("." + dataType, "")
    }
  }
})


setInterval(() => {
  store.autoAdd()
}, 1000) 
