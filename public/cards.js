import { createApp, reactive } from './petite-vue.es.js'
import QrCreator from './qr-creator.es6.min.js'

function template() {
  return {
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
    search: false,
  }
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

let historyTable = [] // history of cards layer by layer just the hash of the cards
function saveCardToLocal(hash, card) {
  // save the diffrance between the card and generated card or template card

  if (!hash) return // window.alert("no hash")
  if (!card) return // window.alert("no card")
  let toSave = diff(template(), card)
  // drop the table, index, hash, key as we can compute them
  delete toSave.table
  delete toSave.index
  delete toSave.hash
  delete toSave.key

  if (Object.keys(toSave).length === 0) return localStorage.removeItem(hash)
  // console.log("toSave", toSave)
  return localStorage.setItem(hash, JSON.stringify(toSave))
}
function saveCard(hash, card) {
  // save the diffrance between the card and generated card or template card

  if (!hash) return // window.alert("no hash")
  if (!card) return // window.alert("no card")
  if (!memCards[hash] && !memLoading[hash]) { // if the card is not in memory or loading
    saveCardToLocal(hash, card)
  }
  if (typeof memCards[hash] === 'object') {
    let toSave = diff({...template(), ...memCards[hash]}, card)
    delete toSave.table
    delete toSave.index
    delete toSave.hash
    delete toSave.key
    if (card.lockPosition || card.source) {
      delete toSave.subCards
    }
    if (Object.keys(toSave).length === 0) return localStorage.removeItem(hash)
    console.log("toSave diff mem & card", toSave, memCards[hash], card)
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
  let obj = {...template(), ...card}; // clones cards so that it can be manipulated without effecting the original let is a local variable
  delete obj.subCards; // removing the subcards from each card so that the hash won't change when adding subcards
  delete obj.doneOn; // removing the doneOn from each card so that the hash won't change when adding doneOn
  delete obj.done; // removing the done from each card so that the hash won't change when adding done
  delete obj.fav; // removing the fav from each card so that the hash won't change when adding fav
  delete obj.search
  // this are for display only
  delete obj.table;
  delete obj.index;
  delete obj.hash;
  delete obj.key;
  obj.toDoFirst = [] // delete in next version

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
let memLoading = {} 
function fetchCards(url, hash, cb = () => {}) {
  if (!memCards[hash]) { // if the card is nxt in memory
    // memCards[hash] = {} // prevent multiple fetches
    if (memLoading[hash]) return console.log("Already loading", hash)
    memLoading[hash] = true
    // if jsonl fetch the cards
    if (url.indexOf(".jsonl") !== -1) {
      fetch(url).then(response => response.text()).then(text => {
        const lines = text.split("\n")
        const cards = lines.filter(card => card.indexOf("}") !== -1).map(card => {
          let hash = card.slice(0, card.indexOf("{")) || makeHash(card)
          return { ...JSON.parse(card.slice(card.indexOf("{"))), hash }
        })
        const forwords = lines.filter(card => card.indexOf("}") === -1)
        if (forwords.length) {
          console.log("Forwords", forwords)
        }
        console.log("cards", cards)
        const firstCard = cards[0]
        memCards[hash] = cards[0]
        cards.forEach((card, i) => {
          memCards[card.hash] = card
        })
        cb(firstCard)
      }).catch(error => {
        memLoading[hash] = false
        console.error("error", error)
        cb({
          title : "Can not get this",
          smBody: url,
        })
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
            const card = {...template(), title, media, body}
            const subHash = makeHash(card)
            subHashes.push(subHash)
            memCards[subHash] = card
            return card
          })
          const loadedCard = { ...template(), title, body,
            media, subCards: subHashes, source: url,
            onlyShowNotDone: true, slice: -3,
            lockPosition: true,
          }
          memCards[hash] = loadedCard // Do be combined with card of hash
          cb(loadedCard)
          console.log("cards loaded", memCards[hash])
        } else {
          // put the cards in page
          console.log("doc", doc)
        }
      }).catch(() => {
        memLoading[hash] = false
        cb({
          title : "Can not get this",
          smBody: url,
          body: url,
        })
      })
    }
  } else {
    console.log("loading ", url)
    cb(memCards[hash])
  }
}

function saveToLocalStorage(file, cb) { //cb is a callback function that is called when the file is read with the first card
  const reader = new FileReader()
  reader.onload = (e) => {
    if (e.target === null || e.target.result === null || typeof e.target.result != "string" || !e.target.result) return alert("No file or file is empty")
    const lines = e.target.result.split("\n")
    const cards = lines.filter(card => card.indexOf("}") !== -1)
      .map(card => JSON.parse(card.slice(card.indexOf("{"))))
    const hashs = lines.filter(card => card.indexOf("}") !== -1)
      .map(card => card.slice(0, card.indexOf("{")))

    cards.forEach((card, i) => {
      saveCardToLocal(hashs[i] || makeHash(card), card)
    })

    const forwords = lines.filter(card => card.indexOf("}") === -1)
    if (forwords.length) {
      console.log("Forwords", forwords)
    }

    alert(" Got " + cards.length + " cards")
    cb({ ...template(), ...cards[0]})
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
const store = reactive({ //updates the html immediately
  loading: true,
  search: "",
  curser: 0,
  pageTitle: '',
  editing: false,
  allSearch: "",
  root: {
    ...template(),
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
    console.log("displayedCards")
    let cards = store.displayedSubCards({...store.root, subCards: store.cards})
    store.currentlyDisplayCards = cards
    return cards
  },
  displayedSubCards: (ofCard) => {
    // Nedded? ofCard = {...template(), ...ofCard}
    const parentCard = makeHash(ofCard)
    let cards = ofCard.subCards.map((card, index) => ({...card, index, hash: makeHash(card)}))
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
          if (!card.toDoFirst.every(hash => {
            const needed = store.loadCard(hash)
            if (!needed) return true // ignore card the do not load
            return needed.done
          })) { // no call back needed as done is local
            return false
          }
        }
      }
      return true
    }).reverse().slice(+ofCard.slice).reverse()
    const siblings = cards.map((card, i) => {
      const next = cards[i + 1]?.hash
      const prev = cards[i - 1]?.hash
      return {next, prev}
    })

    return cards.map((card, index) => ({...card, table: {index, parentCard, siblings}}))
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
  newCard: {...template()},
  editCard: {...template()},
  currentlyDisplayCards: [],
  saveRoot(rootHash = "root") {
    console.log("Saving root")
    let rootCard = { ...this.root}
    rootCard.subCards = this.cards.map(card => makeHash(card))
    let toSave = diff({...template()}, rootCard)
    delete toSave.table
    delete toSave.index
    delete toSave.hash
    delete toSave.key
    if (Object.keys(toSave).length === 0) return localStorage.removeItem(rootHash) // if there nothing to save, remove the card
    if (!rootCard.title && !rootCard.source) return console.log("No title or source", rootCard, rootHash)
    const newHash = makeHash(rootCard)
    saveCard(newHash, rootCard)
    if (newHash !== rootHash) {
      if (localStorage[newHash]) {
        localStorage.setItem(rootHash, newHash)
      }
    }
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
    card.subCards.forEach((subCard, i) => {
      if (!subCard) return
      if (typeof subCard === 'string') {
        if (hashes.includes(subCard)) {
          return
        }
        hashes.push(subCard)
      }
      if (typeof subCard === "object") {
        hashes.push( makeHash(subCard) || "" )
      }
      return hashes = hashes.concat(this.getAllHashesNeededFrom(subCard))
    })
    return [...new Set(hashes)] // removes duplicates
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
    if (this.cacheCards.length) {
      return this.cacheCards
    }
    this.cacheCards = this.setLocalCards()
    return this.cacheCards
  },
  cacheCards: [],
  setLocalCards() {
    return Object.keys(localStorage)
      .filter(key => localStorage[key].indexOf("}") !== -1)
      .map(key => {
         return { ...this.loadCard(key), 
           key,
           listedByCards: this.listedByCards(key), 
           allHashesNeededFrom: this.getAllHashesNeededFrom(key).length - 1
         }
      })
      .sort((a, b) => {
      if (a.allHashesNeededFrom === b.allHashesNeededFrom) {
        return a.listedByCards - b.listedByCards
      }
      return b.allHashesNeededFrom - a.allHashesNeededFrom
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
  removeToDoFirst(card, needed) {
    const neededHash = makeHash(needed)
    // remove neededHash
    card.toDoFirst = card.toDoFirst.filter(hash => hash !== neededHash).filter(hash => !!this.loadCard(hash))
    // return it
    return card
  },
  addToDoFirst(card, needed) {
    const neededHash = makeHash(needed)
    // add neededHash
    card.toDoFirst.push(neededHash)
    card.toDoFirst = card.toDoFirst.filter(hash => !!this.loadCard(hash))

    // return it
    return card
  },
  needToDoFirst(cardHash, neededHash) {
    // load card
    let card = loadCard(cardHash)
    // add neededHash
    card.toDoFirst.push(neededHash)
    // save it
    const newHash = makeHash(card)
    saveCard(newHash, card)
    // add forword
    localStorage.setItem(cardHash, newHash)
  },
  findOrphanedCards() {
    let rootHash = "root"
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
        if (hash === "root") return cards.push(JSON.stringify(this.loadCard(card)))
        return cards.push(hash + card)
      }
      cards.push(hash + card)
    })
    const name = this.root.title || this.pageTitle || this.title || "Sky Cards"
    saveFile(cards.filter(card => typeof card === "string" ).join("\n"), name + " " + cards.length + " cards + key")

  },
  uploadFileInToCard(index) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.jsonl'
    input.onchange = (e) => {
      if (e.target === null) return
      const target =  e.target
      if (target.files && target.files !== null && target.files.length) {
        saveToLocalStorage(target.files[0], (card) => {
          if (index === "root" || index == -1) {
            this.root = {...template(), ...card}
            this.cards = [].concat(card.subCards).map(subCard => this.loadCard(subCard)).filter(card => !!card)
            this.curser = 0
            this.saveRoot("root")
          } else {
            this.cards[index] = {...template(), ...card}
            this.cards[index].subCards = (this.cards[index].subCards || []).concat([card])
          }
        })
      }
    }  
    input.click()
    this.dialogSave()
  },
  loadCard(hash, cb = () => {}) { // returns the card with subcards as hashes
    if (typeof hash === 'object') {
      hash = makeHash(hash)
    }
    if (!hash || hash === "" || hash.length > 8) {
      return cb()
    }
    if (!localStorage.getItem(hash) && !memCards[hash]) {
      if (hash !== "root") {
                
        console.log("No card found", hash)
        return cb()
      }
      
      console.log("No root card found", hash)
      return cb()
    }

    const tempCard = localStorage.getItem(hash) // get the card from local storage
    
    if (tempCard === null && memCards[hash]) {
      let cardFormMem = {}
      if (typeof memCards[hash] === 'object') {
        cardFormMem = { ...template(), ...memCards[hash]}
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
      if (cardFormMem.source || cardFormMem.title) {
        const returns = cb(cardFormMem)
        if (returns) return returns
        return cardFormMem
      } else {
        return console.log("No card with source or title", hash)
      }
    }
    if (tempCard === null) return alert("No card found") // if the card is not found return an alert
    if (tempCard.indexOf("}") === -1) { // not JSON
      if (tempCard.length === 8 && tempCard.indexOf(hash) === -1) {
        return this.loadCard(tempCard, cb) // forword
      }
      if (tempCard.length === 16 && tempCard.indexOf(hash) === -1) {
        return {...this.loadCard(tempCard.slice(0, 8)), ...this.loadCard(tempCard.slice(0, 8))} // Combine
      }
      if (tempCard.length % 8 === 0 && tempCard.indexOf(hash) === -1) return this.loadCard(tempCard.slice(0,16)) // TODO 
      return alert("Not a card " + tempCard)
    }

    let card = { ...template(), ...(memCards[hash] || {}), ...JSON.parse(tempCard)} 

    if (card.source) {
      // console.log("loading...", hash, card)
      if (!memCards[hash]) {
        fetchCards(card.source, hash, (loaded) => {
          const newCard = {...card, ...loaded}
          if (!newCard.title) {
            console.log("No title on loaded card", newCard)
            return
          }
          memCards[hash] = newCard

          cb(newCard)

          // console.log("loaded...", newCard, hash, card)
        })
      } else if (Object.keys(memCards[hash]).length) { // conbine the cards
        // const subCards = memCards[hash].subCards
        card = {...memCards[hash], ...diff({...template()}, card)}
      } else {
        console.log("still loading ?", hash, memLoading)
      }
    }
    card.subCards = card.subCards.map(subHash => {
      if (hash === subHash) {
        console.log("Circular reference", hash)
        return false
      }
      return subHash
    }).filter(card => !!card)
    const returns = cb(card)
    if (returns) return returns
    return card
  },
  path:[],
  setHistoryTable() {
    this.setPath()
    historyTable = ["root", ...this.path.slice(0, -1)].map((hash, pathIndex) => {
      return this.loadCard(hash, (rootCard) => {
        if (!rootCard) {
          return console.log("No card found", hash)
        }
        const loadedRoot = {...rootCard, subCards: rootCard.subCards.map(subCard => this.loadCard(subCard))}
        const cards = this.displayedSubCards(loadedRoot).map(card => card.hash)
        const curser = cards.indexOf(this.path[pathIndex])
        return {cards, curser}
      })
    })
  },  
  setPath() {
    const path = window.location.pathname
    const regex = /[a-zA-Z0-9]{8}/g;
    const segments = path.match(regex);
    if (segments) {
      return this.path = [...segments]
    }
    return this.path = []
  },
  getPathTop() {
    this.setPath()
    return this.path[this.path.length - 1] || "root"
  },
  load(cardHash, newCurser, cb = () => {}) {
    // load cards from local storage
    if (!cardHash) {
      cardHash = this.getPathTop()
    } 

    this.loadCard(cardHash, (card) => {
      if (!card) {
        if (cardHash === "root") {
          // alert("No root card found")
          // load default root card 
          this.root = { ...template(), title: "Sky Cards", body: "A place to keep your cards", source: "/Welcome.jsonl"}
          this.save()
          this.load("root", -1, cb)
        }
        return console.log("No card found", cardHash)
      }

      if (!card.subCards) {
        card.subCards = []
      }

      this.color = card.color
      this.title = card.title
      this.root = { ...template(), ...card} // load the root card
      document.title = this.root.title
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      if (this.root.media && this.getDataType(this.root.media) === "image") {
        link.href = this.root.media
      } else if (this.root.thumbnail) {
        link.href = this.root.thumbnail
      }

      let loadedCards = []
      card.subCards.forEach(subHash => this.loadCard(subHash, subCard => { // load main cards
        if (!subCard) return
        let loadedSubCards = []
        subCard.subCards.forEach(subSubHash => this.loadCard(subSubHash, subSubCard => {
          if (!subSubCard) return
          loadedSubCards.push(subSubCard)
        })) // load sub cards
        loadedCards.push({...subCard, subCards: loadedSubCards})
      }))
      this.cards = loadedCards
      this.displayedCards()
      this.curser = newCurser || 0
      this.layout(this.root.layout)
      console.log("loaded", cardHash, this.root, this.cards)
      this.setColor()
      cb()
    })
  },
  save(cb = () => {}) {
    // save the root card to local storage
    //this.trail = window.location.hash.slice(1).split("/") //this is causing the problem!!
    this.saveRoot(this.getPathTop())
    // save this.cards to local storage hash all cards and save under the hash with a list of hashs for sub cards
    this.cards.forEach(card => {
      const subHashes = card.subCards.map(subCard => makeHash(subCard)).filter(hash => !!hash)
      const cardHash = makeHash(card)
      saveCard(cardHash, {...card, subCards: subHashes})
    })
    cb()
  },
  shallower() {
    this.big = true
    const fresh = this.path.pop()
    window.history.pushState({curser: this.curser}, "", "/" + this.path.join("/"))

    this.load()
    console.log("shallower", this.currentlyDisplayCards)
    const tableCards = historyTable.pop()
    if (tableCards && tableCards.length) {
      this.currentlyDisplayCards = tableCards.map(card => this.loadCard(card))
    }
    console.log("historyTable", historyTable)
    window.requestAnimationFrame(() => {
      this.big = false
      this.curser = this.cards.reduce((curser, card, index) => {
        if (fresh === makeHash(card)) {
          return index
        } 
        return curser
      }, -1) // imperfect solution (confuses if there is more than one card with the same hash)
      this.layout(this.root.layout)
    })
  },
  deeper(curser) {
    this.big = true
    const currentCard = this.cards[this.curser] // this is the card that is being drilled into
    if (!currentCard || currentCard === undefined) return // if null or undefined stop the function
    console.log("deeper", this.currentlyDisplayCards)
    historyTable.push({cards: this.currentlyDisplayCards.map(card => card.hash), curser: this.curser})
    const newHash = makeHash(currentCard)
    window.requestAnimationFrame(() => {
      this.big = false
      this.path.push(newHash)
      window.history.pushState({}, "", "/" + this.path.join("/"))
      this.load(newHash, curser)
      console.log("historyTable", historyTable)
    })
  },
  onEnterTitle(){
    if (!this.newCard.title) return
    else return this.inc()
    addDialog.showModal()
    store.disableKeys = true
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
    this.newCard = {...template()}
  },
  inc(close = true) {
    const card = {...this.editCard, madeOn: Math.round(Date.now() / 1000)} // make a new card
    this.resetNewCard()
    this.curser = this.cards.length
    this.cards = [...this.cards, {...card}]
    this.big = false
    
    if (close) this.closeDialog("addDialog")
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
    this.colorDots()
    let containers = [ ...document.getElementsByClassName("container")]
    containers.forEach(container => {
      container.classList.add("line")
    })

    return () => {
      containers.forEach(container => {
        container.classList.remove("line")
      })
    }
  },
  colorDots() {
    let rootElement = document.getElementById("root")
    const dot = rootElement.getElementsByClassName("dot")[0] 
    if (dot && dot !== null) dot.style.backgroundColor = this.root.color
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
    setTimeout(() => {
      if (store.curser !== -1) {
        const currentIndex = store.currentlyDisplayCards.map(card => card.index)
        const card = document.getElementsByClassName("outerMainCard")[currentIndex.indexOf(store.curser)]
        if (card) {
          card.scrollIntoView({behavior: "smooth", block: "center", inline: "nearest"});
        }
      } else {
        const root = document.getElementById("root");
        if (root) {
          root.scrollIntoView({behavior: "smooth", block: "start", inline: "start"});
        }
      }
    }, 400)
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
        this.editCard.title = this.newCard.title.slice(0, -trigger.length)
        this.inc() 
      }
    })
    if (this.newCard.title.length !== 8) return
    const triggerArrayHash = Object.keys(localStorage).filter(key => key.length === 8).filter(key => {
      return key !== makeHash(this.root) && key !== makeHash(this.newCard)
    }).forEach(cardHash => {
      if (this.newCard.title === cardHash) {
        this.editCard = {...this.loadCard(cardHash)}
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
      this.currentlyDisplayCards = this.displayedCards()
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
        const rootHash = this.getPathTop()
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
    const temp = {...this.cards[index]}
    this.removeCard(index)
    this.save()
    this.path = this.path.slice(0, -1)
    this.load()
    this.cards = this.cards.concat([{...temp}])
    this.save()
  },
  removeCard(index) {
    this.cards.splice(index, 1)
    this.save()
    this.load()
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
  openDialog(dialog, cardToEdit) {
    this.editing = true
    this.disableKeys = true
    if (cardToEdit) {
      this.editCard = {...cardToEdit}
      this.editingHash = makeHash(cardToEdit)
    } else {
      this.editCard = {...this.newCard}
      this.editingHash = ""
    }
    window.requestAnimationFrame(() => {
      this.big = false
      const openDialog = document.getElementById(dialog)
      console.log("addDialog", dialog, openDialog)
      openDialog.showModal()
    })
  },
  dialogSave(close = true){
    console.log("dialog save")
    if (this.editingHash) {
      this.currentlyDisplayCards = this.currentlyDisplayCards.map(card => {
        if (card.hash === this.editingHash) {
          this.cards[card.index] = {...this.editCard}
          return {...this.editCard}
        }
        return card
      })
      if (this.editingHash !== makeHash(this.root)) { 
        localStorage.setItem(this.editingHash, makeHash(this.editCard))
      }
      saveCard(this.editingHash, this.editCard)
      const rootHash = makeHash(this.root)
      if (this.editingHash === rootHash) {
        this.root = {...this.root, ...this.editCard}
        this.saveRoot(rootHash)
      }
    } else {
      this.cards = [...this.cards, {...this.editCard}]
    }
    this.save()
    if (close) {
      this.closeDialog("addDialog")
      this.closeDialog("editDialog")
    }
    const theCards = this.displayedCards()
    console.log("the cards", theCards)
  },
  dialogSaveNew(){
    this.editingHash = ""
    this.editCard.madeOn = Math.round(Date.now() / 1000)
    this.dialogSave()
  },
  doneSave(card, done) {
    this.editingHash = makeHash(card)
    if (done) {
      this.editCard = {...card, done, doneOn: [...(card.doneOn || []), Math.round(Date.now() / 1000)]}
    } else {
      this.editCard = {...card, done}
    }
    this.dialogSave()
  },
  favSave(card, fav) {
    this.editingHash = makeHash(card)
    this.editCard = {...card, fav}
    this.dialogSave()
  },
  closeDialog(dialog) {
    const addDialog = document.getElementById(dialog)
    store.disableKeys = false
    addDialog.close()
    store.editing = false
  },
  endedAutoplay(card, index) {
    console.log(card, index)
    this.doneSave(card, true)
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
    const imageFormats = ["jpg", "jpeg", "svg", "webp","png",  "gif"]
    const videoFormats = ["mp4", "ogg",  "mpeg","mov", "avi", "webm"]
    const audioFormats = ["mp3", "wav",  "ogg", "m4a", "flac", "aac"]
    if (!url) return ""
    if (imageFormats.includes(url.slice(-3))) return "image"
    if (imageFormats.includes(url.slice(-4))) return "image"
    if (videoFormats.includes(url.slice(-3))) return "video"
    if (videoFormats.includes(url.slice(-4))) return "video"
    if (audioFormats.includes(url.slice(-3))) return "audio"
    if (audioFormats.includes(url.slice(-4))) return "audio"
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
  loadMemPath(cb = () => {}) {
    let path = ["root", ...this.setPath()]
    if (path.length > 1) {
      const getCard = (pathIndex) => { // load the cards in the path one by one
        if (path[pathIndex]) {
          this.loadCard(path[pathIndex], (card) => {
            if (pathIndex === 0 && !card) {
              const bace = { ...template(), title: "Sky Cards", body: "A place to keep your cards", source: "/Welcome.jsonl"}
              const hash = makeHash(bace)
              saveCard(hash, bace)
              localStorage.setItem("root", hash)
              return getCard(0) // now that the root card is saved, try again
            }
            if (!card) return console.log("No card found", path[pathIndex])
            getCard(pathIndex + 1)
          })
        } else {
          cb()
        }
      }
      getCard(0) // start the loop
    } else {
      cb()
    }
  },
  unlock() {
    localStorage.setItem("root", '{"title":"Sky Cards","body":"A place to keep your cards"}')
    window.location.reload("/")
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
  
  if (e.keyCode == 38 || e.keyCode == 87 || e.keyCode == 75) { // up
    if (store.curser === -1) {
      store.shallower()
    } else {
      store.curser = -1
      const root = document.getElementById("root");
      if (root) {
        root.scrollIntoView({behavior: "smooth", block: "start", inline: "start"});
      }
    }
  }
  if (e.keyCode == 40 || e.keyCode == 83 || e.keyCode == 74) { // down
    if (store.curser == -1) {
      store.curser = 0
    } else {
      store.deeper(-1)
    }
  }
  if (e.keyCode == 13) { // enter
    if (store.curser == -1) {
      if (store.path.length) {
        store.shallower()
      } else {
        store.toggleBig()
      }
    } else {
      store.deeper(currentIndex[store.curser])
    }
  }
  if (e.keyCode == 37 || e.keyCode == 65 || e.keyCode == 72) { // left
    if (e.shiftKey) {
      store.swapCards(currentIndex[store.curser], currentIndex[store.curser -1])
    } else {
      if (store.curser === -1) {
        let table = historyTable[historyTable.length - 1]
        if (table && table.cards[table.curser - 1]) {
          store.load(table.cards[table.curser - 1], -1)
          store.path.pop()
          store.path.push(table.cards[table.curser - 1])
          window.history.pushState({}, "", "/" + store.path.join("/"))
          historyTable[historyTable.length - 1].curser--
        }
      } else if (currentIndex[store.curser - 1] === undefined) {
      } else {
        store.curser = Math.max(currentIndex[store.curser -1], -1)
      }
    }
  }
  if (e.keyCode == 39 || e.keyCode == 68 || e.keyCode == 76) { // right
    if (e.shiftKey) {
      store.swapCards(currentIndex[store.curser], currentIndex[store.curser + 1])
    } else {
      if (store.curser === -1) {
        let table = historyTable[historyTable.length - 1]
        if (table && table.cards[table.curser + 1]) {
          store.load(table.cards[table.curser + 1], -1)
          store.path.pop()
          store.path.push(table.cards[table.curser + 1])
          window.history.pushState({}, "", "/" + store.path.join("/"))
          historyTable[historyTable.length - 1].curser++
        }
      } else if (currentIndex[store.curser + 1] === undefined) {
      } else {
        store.curser = Math.min(currentIndex[store.curser + 1], currentIndex[currentIndex.length - 1])
      }
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
store.loadMemPath(() => {
  store.loading = true
  store.load("", -1, () => {
    store.setHistoryTable()
    store.loading = false
  })
})
setTimeout(() => {
  document.title = store.root.title
  document.body.style.display = "block"
}, 200)
window.onhashchange = function(e) {
  console.log("hash change", e)
  store.load()
}
window.onpopstate = function(e) {
  console.log("pop state", e)
  store.load()
}
window.addEventListener("error", (e) => {
  console.log("add error", e)
  // reload the page
  // window.location.reload()
})
window.onerror = (e) => {
  console.log("on error", e)
}

window.addEventListener("message", (e) => {
  if (document.getElementById("addDialog").open || e.data.number != 1) {
    if (e.data.file.type.indexOf('image') !== -1) {
      if (store.getDataType(store.newCard.media) === "video") {
        return store.editCard.thumbnail = e.data.url
      }
    }
    if (store.getDataType(e.data.url) === "video") {
      store.editCard.media = e.data.url
      store.editCard.thumbnail = e.data.thumbnail
    }
    if (store.getDataType(e.data.url) === "image") {
      store.editCard.media = e.data.url
    }
    if (store.getDataType(e.data.url) === "audio") {
      store.editCard.media = e.data.url
    }
    if (e.data.file && !store.editCard.title) {
      const dataType = getUrlExtension(e.data.file.name)
      if (e.data.file.name.indexOf("_") !== -1) {
        store.editCard.title = e.data.file.name.split("_")[0]
      } else {
        store.editCard.title = e.data.file.name.replace("." + dataType, "")
      }
    }
    if (!store.editCard.color) {
      store.editCard.color = e.data.dotColor
    }
    if (e.data.number > 1) { // auto add
      console.log("auto add", e.data.index)
      const dataType = getUrlExtension(e.data.file.name)

      if (e.data.file.name.indexOf("_") !== -1) {
        store.editCard.title = e.data.file.name.split("_")[0]
      } else {
        store.editCard.title = e.data.file.name.replace("." + dataType, "")
      }
      store.editCard.media = e.data.url
      store.editCard.thumbnail = e.data.thumbnail
      store.editCard.color = e.data.dotColor
      store.editCard.madeOn = Math.round(Date.now() / 1000)
      store.cards = [...store.cards, {...store.editCard}]
      store.saveRoot(makeHash(store.root))
      store.openDialog("addDialog", store.editCard)
      store.dialogSave(false)
      
    }
  } else {
    if (store.getDataType(e.data.url) === "image") {
      if (store.getDataType(store.root.media) === "video" || store.getDataType(store.root.media) === "audio"){
        return store.editCard.thumbnail = e.data.url
      }
    }
    if (store.getDataType(e.data.url) === "video") {
      store.editCard.media = e.data.url
    }
    if (store.getDataType(e.data.url) === "image") {
      store.editCard.media = e.data.url
    }
    if (store.getDataType(e.data.url) === "audio") {
      store.editCard.media = e.data.url
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
// check if user is selecting text
store.isSelecting = false
document.addEventListener('selectionchange', () => {
  store.isSelecting = document.getSelection().type === 'Range'
})
setTimeout(() => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        console.log('Service Worker registered with scope:', registration.scope)
      }).catch((error) => {
        console.error('Service Worker registration failed:', error)
      })
    })
  }
}, 60000) // wait a minute before registering the service worker

