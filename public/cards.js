import { createApp, reactive } from './petite-vue.es.js'
import QrCreator from './qr-creator.es6.min.js'

function template() {
  return {
    title: "", 
    body: "",
    smBody: "",       // short body for the card
    source: "",       // url if from the web only save updates under the hash of the generated card 
    subCards: [],     // array of cards
    toDoFirst: [],    // array of cards that need to be before this card
    done: false,
    color: '',        // dot color and background color of the page
    hideDone: false,
    media: "",        // url of the media, can be audio, video or image
    autoplay: false,  
    thumbnail: "",    // thumbnail for the media just video for now
    layout: "line",   // line, circle, grid
    slice: 0,         // slice the subCards array
    onlyShowDone: false,
    onlyShowNotDone: false,
    onlyShowDoable: false,
    noEditing: false,
    lockPosition: false,
    mix: false,     // mix the subCards
    doneOn: [],     // list of dates
    madeOn: "",     // date
    fav: false,     // favorite
    search: false,  // search subCards
    startAt: 0,     // start at time for audio and video
    playbackRate: 1,// playback rate for audio and video
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

let historyTable = [] // history of cards layer by layer cards
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
  if (card.fromMemory) console.log("fromMemory saving", card)
  if (!feedCards[hash] && !memLoading[hash]) { // if the card is not in memory or loading
    saveCardToLocal(hash, card)
  }
  if (typeof feedCards[hash] === 'object') {
    let toSave = diff({...template(), ...feedCards[hash]}, card)
    delete toSave.table
    delete toSave.index
    delete toSave.hash
    delete toSave.key
    delete toSave.fromMemory
    if (card.lockPosition || card.source) {
      delete toSave.subCards
    }
    if (Object.keys(toSave).length === 0) return localStorage.removeItem(hash)
    console.log("toSave", toSave, localStorage.getItem(hash))
    return localStorage.setItem(hash, JSON.stringify(toSave))
  }
  if (typeof feedCards[hash] === 'string') {
    console.log("feedCards[hash] save", feedCards[hash])
  }
}
function removeNullValues(array) {
  if (!Array.isArray(array)) return [] // if not an array return empty array
  return array.filter(value => value !== null) || [] // removes null values from the array
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
  delete obj.fromMemory;
  delete obj.startAt;
  delete obj.playbackRate;
  delete obj.lockPosition;
  delete obj.onlyShowDone;
  delete obj.onlyShowNotDone;
  delete obj.onlyShowDoable;
  delete obj.mix;
  delete obj.slice;
  delete obj.autoplay;
  delete obj.noEditing;
  delete obj.puaseOthers;
  delete obj.toDoFirst;

  const str = JSON.stringify(obj);
  let hash = 0;
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
let feedCards = {} // Memory cards save fetchable cards (immutable) just rss at the moment.
let memLoading = {}
let loadedCardsFromJsonl = {} // loaded cards
let combinedCards = {} // combined cards (immutable)

function fetchCards(card, hashGetting, cb = () => {}) {
  console.log("fetchCards", card, hashGetting)
  const url = card.source
  if (!loadedCardsFromJsonl[hashGetting]) { // if the card is in memory
    // if jsonl fetch the cards
    if (url.indexOf(".jsonl") !== -1) {
      if (memLoading[hashGetting]) {
        console.log("Already loading jsonl", hashGetting)
        setTimeout(() => {
          console.log("After 3 sec loading jsonl", hashGetting)
          cb(loadedCardsFromJsonl[hashGetting] || feedCards[hashGetting] || {})
	}, 3000)
	return
      }
      memLoading[hashGetting] = true
      fetch(url).then(response => response.text()).then(text => {
        const lines = text.split("\n")
        const hashSwap = [] // [[old, new] ... ] swap subCards
        const cards = lines.filter(card => card.indexOf("}") !== -1).map(card => {
          let hash = card.slice(0, card.indexOf("{"))
          const madeHash = makeHash(JSON.parse(card.slice(card.indexOf("{"))))
          if (hash.length !== 8) {
            hash = makeHash(JSON.parse(card.slice(card.indexOf("{"))))
          }
          if (hash !== madeHash) {
            console.log("hashs not matching", hash, madeHash)
            hashSwap.push([hash, madeHash])
          }
          console.log("hash", hash)
          return { ...JSON.parse(card.slice(card.indexOf("{"))), hash, fromMemory: true }
        })
        let firstCard = cards[0]
        const forwards = lines.filter(card => card.indexOf("}") === -1)
        let rootIndex = forwards.findIndex(forward => forward.indexOf("root") !== -1) 
        if (forwards.length) {
          forwards.forEach(forward => {
            if (forward.indexOf("root") === -1) {
              const from = forward.slice(0, 8)
              const to = forward.slice(8).replaceAll('"','')
              loadedCardsFromJsonl[from] = to
              hashSwap.push([from, to])
            } else {
              loadedCardsFromJsonl[forward.slice(0, 4)] = forward.slice(4).replaceAll('"','')
              firstCard = forward.slice(4)
            }
          })
        }
        if (typeof firstCard === 'string') {
          const neededSwap = hashSwap.find(swap => swap[0] === firstCard)
          if (neededSwap) {
            firstCard = neededSwap[1]
          }
          firstCard = loadedCardsFromJsonl[firstCard] || firstCard
        }
        loadedCardsFromJsonl[hashGetting] = firstCard
        cards.forEach((card, i) => {
          if (hashSwap.length) {
            console.log("card.subCards", card.subCards)
            card.subCards = removeNullValues(card.subCards).map(subCard => {
              const found = hashSwap.find(swap => swap[0] === subCard)
              if (found) {
                return found[1]
              }
              return subCard
            })
            console.log("card.subCards", card.subCards)
          }
          loadedCardsFromJsonl[card.hash] = card
          const found = hashSwap.find(swap => swap[0] === card.hash)
          if (found) {
            loadedCardsFromJsonl[found[1]] = card
          }
        })
        return cb(firstCard)
      }).catch(error => {
        memLoading[hashGetting] = false
        console.error("error", error)
        return cb({
          title : error.message || "Can not get this, try again later",
          smBody: url,
        })
      })  
    }
  }
  if (!feedCards[hashGetting]) { // if the card is in memory
    if (memLoading[hashGetting]) return console.log("Already loading", hashGetting)
    fetch(url).then(response => response.text()).then(text => { // if xml/rss fetch the cards
      const doc = new window.DOMParser().parseFromString(text, "text/xml")
      // make card and subcards
      if (doc.querySelectorAll("rss > channel > image > url")[0]) { // if the rss has an image
        if (memLoading[hashGetting]) return console.log("Already loading rss", hashGetting)
        memLoading[hashGetting] = true
        const media = doc.querySelectorAll("rss > channel > image > url")[0].textContent
        const title = doc.querySelectorAll("rss > channel > title")[0].textContent
        const body = doc.querySelectorAll("rss > channel > description")[0].textContent
        const items = doc.querySelectorAll("rss > channel > item")
        Promise.all(Array.from(items).map(item => {
          const sTitle = item.querySelectorAll("title")[0].textContent
          const sMedia = item.querySelectorAll("enclosure")[0].getAttribute("url")
          const sBody = item.querySelectorAll("description")[0].textContent
          const smBody = title + " - " + sTitle
          // const madeOn = item.querySelectorAll("pubDate")[0].textContent
          // const thumbnail = item.querySelectorAll("thumbnail")[0].getAttribute("url")
          const startAt = card.startAt || 0
          const layout = card.layout || "line"
          const autoPlay = card.autoPlay || false
          const playbackRate = card.playbackRate || 1
          const sCard = {
            ...template(),
            title: sTitle,
            media: sMedia,
            body: sBody,
            smBody,
            // madeOn,
            startAt,
            layout,
            autoPlay,
            playbackRate,
          }

          console.log("rss sub card - ", sCard)
          const subHash = makeHash(sCard)
          feedCards[subHash] = { ...sCard, fromMemory: true, hash: subHash }
          return subHash
        })).then(subHashs => {
          console.log("subHashs", subHashs)
          const loadedCard = { ...template(), title, body,
            media, subCards: subHashs, source: url,
            onlyShowNotDone: true, slice: -5,
            lockPosition: true,
            fromMemory: true,
            noEditing: true,
            hash: hashGetting,
          }
          feedCards[hashGetting] = loadedCard // Do be combined with card of hash
          feedCards[makeHash(loadedCard)] = loadedCard // Just in case TODO 
          cb(loadedCard)
        })
      } else {
        // put the cards in page
        console.log("doc", doc)
      }
    }).catch(error => {
      memLoading[hashGetting] = false
      console.error("error", error)
      cb({
        title : "Can not get this",
        smBody : url,
        body : error.message || "Can not get this, try again later",
        noEditing : true,
      })
    }) 
  }

  if (loadedCardsFromJsonl[hashGetting] || feedCards[hashGetting]) {
    cb({ ...(loadedCardsFromJsonl[hashGetting] || {}), ...(feedCards[hashGetting] || {})})
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
      delete card.noEditing
      delete card.fromMemory
      if (card.source && card.subCards) {
        console.log("both source & subCards", card)
      }
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
  mediaSaveTime(e){
    const media = e.target
    // find parent element data hash
    const card = media.closest("[data-hash]")
    const startAt = Math.floor(media.currentTime)
    if (startAt) {
      if (+card.dataset.index == -1) {
        store.root.startAt = startAt
        return saveCard(card.dataset.hash, store.root)
      } 
      if (store.cards[+card.dataset.index]) {
        store.cards[+card.dataset.index].startAt = startAt
        saveCard(card.dataset.hash, store.cards[+card.dataset.index])
      }
    }
  },
  displayedCards: () => {
    console.log("displayedCards")
    let cards = store.displayedSubCards({...store.root, subCards: store.cards})
    store.currentlyDisplayCards = cards
          // set Table history
    historyTable[store.path.length] = {cards, curser: Math.max(store.curser, 0)}
    return cards
  },
  displayedSubCards: (ofCard) => {
    // Nedded? ofCard = {...template(), ...ofCard}
    const parentCard = makeHash(ofCard)
    let cards = removeNullValues(ofCard.subCards.map((card, index) => ({...card, index, hash: makeHash(card)})))
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
      const next = cards[i + 1]?.index
      const prev = cards[i - 1]?.index
      return {next, prev}
    })

    return cards.map((card, index) => ({
      ...card, 
      table: {
        index, 
        parentCard, 
        next: siblings[index].next, 
        prev: siblings[index].prev,
      }
    }))
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
  tableLeft: false,
  tableRight: false,
  setTable() {
    if (this.path.length === 0) {
      this.tableRight = false
      this.tableLeft = false
      return
    }
    let table = historyTable[store.path.length - 1] || false
    if (table && table.cards[table.curser + 1]) {
      this.tableRight = () => {
        store.load(table.cards[table.curser + 1], -1)
        store.path.pop()
        store.path.push(table.cards[table.curser + 1].hash)
        window.history.pushState({}, "", "/" + store.path.join("/"))
        historyTable[store.path.length - 1].curser++
      }
    } else {
      this.tableRight = false
    }
    if (table && table.cards[table.curser - 1]) {
      this.tableLeft = () => {
        store.load(table.cards[table.curser - 1], -1)
        store.path.pop()
        store.path.push(table.cards[table.curser - 1].hash)
        window.history.pushState({}, "", "/" + store.path.join("/"))
        historyTable[store.path.length - 1].curser--
      }
    } else {
      this.tableLeft = false
    }
  },
  newCard: {...template()},
  editCard: {...template()},
  currentlyDisplayCards: [],
  setCurser: (index) => {
    store.curser = index
    if (historyTable[store.path.length]) {
      historyTable[store.path.length].curser = Math.max(index, 0)
    }
    if (store.currentlyDisplayCards[index]) {
      store.setFocus(store.currentlyDisplayCards[index], index)
    }
  },
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
    this.displayedCards()
    this.save()
  },
  removeCardLocal(hash) {
    localStorage.removeItem(hash)
  },
  localCards() {
    if (this.cacheCards.length) {
      return this.cacheCards
    }
    this.cacheCards = this.getLocalCards()
    return this.cacheCards
  },
  cacheCards: [],
  getLocalCards() {
    return Object.keys(localStorage).filter(key => localStorage[key].indexOf("}") !== -1).map(key => {
      return { 
        ...this.loadCard(key), 
        key,
        listedByCards: this.listedByCards(key), 
        allHashesNeededFrom: this.getAllHashesNeededFrom(key).length - 1
      }
    }).sort((a, b) => {
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
  export() {
    let cards = []
    const locals = Object.keys(localStorage)
    locals.forEach(key => {
      if (typeof localStorage[key] !== 'string' || (key.length !== 8 && key.length !== 4)) return // only save cards with 8 or 4 char hash
      // if null value in localStorage[key] then remove them.
      let line = key + localStorage.getItem(key)
      if (localStorage[key].indexOf("null") !== -1) {
        line = key + JSON.stringify(this.loadCard(key))
      }
      cards.push(line)
    })
    const name = this.root.title || this.pageTitle || this.title || "Sky Cards"
    saveFile(cards.join("\n"), name + " all " + cards.length + " lines")
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
  loadedToFile(){
    let cards = []
    const fromFile = Object.keys(loadedCardsFromJsonl)
    fromFile.forEach(key => {
      if (typeof loadedCardsFromJsonl[key] === 'object' && (key.length === 8 || key.length === 4)) {
        const line = key + JSON.stringify(loadedCardsFromJsonl[key])
        cards.push(line)
      } else if (typeof loadedCardsFromJsonl[key] === 'string' && (key.length === 8 || key.length === 4)) {
        const line = key + loadedCardsFromJsonl[key]
        cards.push(line)
      }
    })

    const locals = Object.keys(localStorage)
    locals.forEach(key => {
      if (typeof localStorage[key] === 'string' && (key.length === 8 || key.length === 4)) {
        const line = key + localStorage[key]
        cards.push(line)
      }
    })
    
    if (cards.length) {	  
      const name = this.root.title || this.pageTitle || this.title || "Sky Cards"
      saveFile(cards.join("\n"), name + " all " + cards.length + " lines")
    } else {
      alert("no cards")
    }

  },
  loadedToEdit() {
    const fromFile = Object.keys(loadedCardsFromJsonl)
    let count = 0
    fromFile.forEach(key => {
      if (localStorage[key]) return console.log("Already loaded", key)
      if (typeof loadedCardsFromJsonl[key] === 'object' && (key.length === 8 || key.length === 4)) {
        localStorage.setItem(key, JSON.stringify(loadedCardsFromJsonl[key]))
      } else if (typeof loadedCardsFromJsonl[key] === 'string' && (key.length === 8 || key.length === 4)) {
        localStorage.setItem(key, loadedCardsFromJsonl[key])
      }
      count++
    })
    alert("Loaded " + count + " cards from file to local storage so editable.")
  },
  import() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.jsonl'
    input.onchange = (e) => {
      if (e.target === null) return
      const target =  e.target
      if (target.files && target.files !== null && target.files.length) {
        const file = target.files[0]
        const reader = new FileReader()
        reader.onload = (e) => {
          if (e.target === null || e.target.result === null || typeof e.target.result != "string" || !e.target.result) return alert("No file or file is empty")
          const lines = e.target.result.split("\n")
          lines.forEach(line => {
            if (line.indexOf("root") !== 0) {
              const hash = line.slice(0, 8)
              const cardAsStr = line.slice(8)
              if (cardAsStr.indexOf("{") !== -1) {
	        let card = JSON.parse(cardAsStr)
		card.subCards = removeNullValues(card.subCards)
	        delete card.fromMemory
                delete card.noEditing
                localStorage.setItem(hash, JSON.stringify(card))
	      } else {
                localStorage.setItem(hash, cardAsStr)
              }
            } else {
              const hash = "root"
              const cardAsStr = line.slice(4)
              if (cardAsStr.indexOf("(") !== -1) {
	        let card = JSON.parse(cardAsStr)
	        delete card.fromMemory
                delete card.noEditing
                localStorage.setItem(hash, JSON.stringify(card))
	      } else {
                localStorage.setItem(hash, cardAsStr)
              }
            }
          })
          alert(" Got " + lines.length + " cards")
          window.location.reload()
        }
        reader.readAsText(file)          
      }
    }  
    input.click()
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
  mainCardTap(card, i){
    if (this.curser === card.index) {
      this.deeper(-1, i)
    } else {
      this.curser = card.index
      if (historyTable[store.path.length]) {
        historyTable[store.path.length].curser = card.index
      }
      this.setFocus(card, i)
    }
  },
  pauseAllMedia() {
    const media = document.querySelectorAll("audio, video")
    media.forEach(m => {
      m.pause()
    })
  },
  setFocus(card, i) {
    if ("audio" === this.getDataType(card.media)) {
      let audioEle = {}
      if (i > -1 && document.getElementsByClassName("outerMainCard")[i]) {
        audioEle = document.getElementsByClassName("outerMainCard")[i].querySelector("audio")
      } else if (i === -1 && document.getElementsByClassName("rootCard")[0]) {
        audioEle = document.getElementsByClassName("rootCard")[0].querySelector("audio")
      }
      if (audioEle) {
        audioEle.focus()
        if (this.root.autoplay) {
          if (card.pauseOthers || this.root.pauseOthers) {
            this.pauseAllMedia()
          }
          audioEle.play()
        }
        if (audioEle.currentTime === 0) {
          audioEle.currentTime = Math.max(0, +card.startAt, +this.root.startAt)
          audioEle.playbackRate = card.playbackRate || this.root.playbackRate || 1
        }
      }
    }
    if ("video" === this.getDataType(card.media)) {
      let videoEle = {}
      if (i > -1 && document.getElementsByClassName("outerMainCard")[i]) {
        videoEle = document.getElementsByClassName("outerMainCard")[i].querySelector("video")
      } else if (i === -1 && document.getElementsByClassName("rootCard")[0]) {
        videoEle = document.getElementsByClassName("rootCard")[0].querySelector("video")
      }
      if (videoEle) {
        videoEle.focus()
        if (this.root.autoplay) {
          if (card.pauseOthers || this.root.pauseOthers) {
            this.pauseAllMedia()
          }
          videoEle.play()
        }
        if (videoEle.currentTime === 0) {
          videoEle.currentTime = card.startAt || this.root.startAt || 0
          videoEle.playbackRate = card.playbackRate || this.root.playbackRate || 1
        }
      }
    }
  },
  makeCard: (hash, tempCard) => {
    if (typeof hash === 'object') {
      hash = makeHash(hash)
    }
    if (typeof tempCard === 'string') {
      if (tempCard.indexOf("}") !== -1) tempCard = JSON.parse(tempCard)
    }
    const getLocal = (h, i = 0) => {
      if (i > 20) return console.log("To many forwords")
      let localCard = localStorage.getItem(h)
      let output = {}
      if (localCard) {
        if (localCard.indexOf("}") !== -1) {
          output = JSON.parse(localCard)
        } else {
          output = getLocal(h, i + 1)
        }
      }
      if (typeof output === 'object') return output
      return {}
    }
    const gotCard = {
      ...template(),
      ...(typeof tempCard === "object" ? tempCard : {}),
      ...(typeof loadedCardsFromJsonl[hash] === "object" ? { ...loadedCardsFromJsonl[hash], noEditing: true} : {}),
      ...(typeof feedCards[hash] === "object" ? { ...feedCards[hash], noEditing: true} : {}),
      ...(typeof combinedCards[hash] === "object" ? combinedCards[hash] : {}),
      ...getLocal(hash),
      hash,
    }
    gotCard.subCards = removeNullValues(gotCard.subCards)
    return gotCard
  },
  loadCard(hash, cb = c => c) { // returns the card with subcards as hashes
    if (typeof hash === 'object') {
      hash = makeHash(hash)
    }
    if (!hash || hash === "" || hash.length > 8) {
      return cb()
    }
    if (!localStorage.getItem(hash) && !feedCards[hash] && !loadedCardsFromJsonl[hash]) {
      if (combinedCards[hash]) {
        return cb(combinedCards[hash])
      }
      if (hash !== "root") {
        const cardFormloaded = this.cards.find(card => (card.hash === hash || makeHash(card) === hash))
        if (cardFormloaded) {
          return cb(cardFormloaded)
        }
        console.log("No card found", hash)
        return cb()
      }
    }
    let tempCard = loadedCardsFromJsonl[hash] || localStorage.getItem(hash)

    if (loadedCardsFromJsonl[hash]) {
      tempCard = { ...tempCard, noEditing: true }
    }

    if (hash === "root" && !localStorage.getItem("root")) {
      tempCard = { ...template(), title: "Sky Cards", body: "A place for cards", source: "https://firebasestorage.googleapis.com/v0/b/sky-cards.appspot.com/o/site%2Fhome.jsonl?alt=media"}
    }

    if (tempCard === null) tempCard = feedCards[hash]
    if (!tempCard) return alert("No card found")
    if (typeof tempCard === "string" && tempCard.indexOf("}") === -1) { // not JSON
      if (tempCard.length === 8 && tempCard.indexOf(hash) === -1) {
        // if the card is a forword card we need to save the hash and the hash it is pointing to
        // so we need to update the it's parent card and the store.path and the url
        if (store.path.includes(hash)) {
          this.path = this.path.map(segment => {
            if (segment == hash) return tempCard
            return segment
          })
          window.history.replaceState({}, "", "/" + this.path.join('/'))
        }
        console.log(this.root)
        if (this.root.subCards.length) {
          this.root.subCards.forEach((subCard, i) => {
            if (subCard === hash) {
              this.root.subCards[i] = tempCard
            }
          })
        }
        
        return this.loadCard(tempCard, cb) // forword
      }
      if (tempCard.length === 16 && tempCard.indexOf(hash) === -1) {
        return {...this.loadCard(tempCard.slice(0, 8)), ...this.loadCard(tempCard.slice(8))} // Combine
      }
      if (tempCard.length % 8 === 0 && tempCard.indexOf(hash) === -1) return this.loadCard(tempCard.slice(0,16)) // TODO 
      return alert("Not a card " + tempCard)
    }
    
    if (tempCard === null && feedCards[hash]) {
      let cardFormMem = {}
      if (typeof feedCards[hash] === 'object') {
        cardFormMem = { ...template(), ...feedCards[hash], fromMemory: true}
        cardFormMem.subCards = removeNullValues(cardFormMem.subCards.map(sub => {
          if (typeof sub === 'object') {
            return sub
          }
          if (typeof sub === 'string') {
            if (sub === hash) return console.log("Circular reference", hash)
            return this.loadCard(sub)
          }
          console.log("Not a card", sub)
          return false
        }).filter(card => !!card))
      }
      if (cardFormMem.source || cardFormMem.title) {
        const returns = cb(cardFormMem)
        if (returns) return returns
        return cardFormMem
      } else {
        return console.log("No card with source or title", hash)
      }
    }
    let card = this.makeCard(hash, tempCard)
    if (card.source) {
      // overwrite the card with the memory card but not display options
      let overWriteCard = {...(feedCards[hash] || {})}

      delete overWriteCard.onlyShowDone
      delete overWriteCard.onlyShowNotDone
      delete overWriteCard.onlyShowDoable
      delete overWriteCard.noEditing
      delete overWriteCard.lockPosition
      delete overWriteCard.mix
      delete overWriteCard.doneOn
      delete overWriteCard.slice
      delete overWriteCard.search
      delete overWriteCard.layout
      delete overWriteCard.done
      delete overWriteCard.fav


      const {mix, done, doneOn, fav, slice, onlyShowDone, onlyShowNotDone, onlyShowDoable, noEditing, lockPosition, search, layout} = card // display options load from local storage

      card = {...template() , ...card, ...overWriteCard}
      if (!memLoading[hash]) {
        return fetchCards(card, hash, (loaded) => {
          if (typeof loaded === 'string') {
            loaded = this.loadCard(loaded)
          }
          // combine the cards alouding the display options
          const newCard = {...card, ...loaded, hash, mix, done, doneOn, fav, slice, onlyShowDone, onlyShowNotDone, onlyShowDoable, noEditing, lockPosition, search, layout}
          combinedCards[hash] = newCard
          combinedCards[makeHash(newCard)] = newCard

          cb(newCard)
        })
      } else if (feedCards[hash] && Object.keys(feedCards[hash]).length) { // conbine the cards
        // const subCards = feedCards[hash].subCards
        const newCard = {...card, ...feedCards[hash], hash, mix, done, doneOn, fav, slice, onlyShowDone, onlyShowNotDone, onlyShowDoable, noEditing, lockPosition, search, layout}
        combinedCards[hash] = newCard
        return cb(newCard)
      } else if (loadedCardsFromJsonl[hash] && Object.keys(loadedCardsFromJsonl[hash]).length) { 
        const newCard = {...card, ...loadedCardsFromJsonl[hash], hash, mix, done, doneOn, fav, slice, onlyShowDone, onlyShowNotDone, onlyShowDoable, noEditing: true, lockPosition, search, layout}
        combinedCards[hash] = newCard
        return cb(newCard)
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
    return cb(card)
  },
  path:[],
  setHistoryTable() {
    this.setPath()

    historyTable = ["root", ...this.path].map((hash, pathIndex) => {
      return this.loadCard(hash, (rootCard) => {
        if (!rootCard) {
          return console.log("No card found", hash)
        }
        const loadedRoot = {...rootCard, subCards: rootCard.subCards.map(subCard => this.loadCard(subCard))}
        const cards = this.displayedSubCards(loadedRoot)
        const curser = cards.indexOf(this.path[pathIndex])
        
        if (curser === -1) {
          console.log("Curser not found", this.path[pathIndex], cards)
          return {cards, curser: 0}
        }
        return {cards, curser}
      })
    })
    if (historyTable[this.path.length - 1]) {
      historyTable[this.path.length - 1].curser = historyTable[this.path.length - 1].cards.reduce((curser, card, index) => {
	if (this.root.hash === card.hash) {
	  return index
	}
	return curser
      }, historyTable[this.path.length - 1].curser)
    }
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
  load(cardHash, newCurser, cb = () => {}, cardsOnTable = {}) {
    // load cards from local storage
    if (!cardHash) {
      cardHash = this.getPathTop()
    } 

    this.loadCard(cardHash, (card) => {
      console.log(cardHash, card)
      if (!card) {
        if (cardHash === "root") {
          // alert("No root card found")
          // load default root card 
          this.root = { ...template(), title: "Sky Cards", body: "A place to keep your cards", source: "https://firebasestorage.googleapis.com/v0/b/sky-cards.appspot.com/o/site%2Fhome.jsonl?alt=media"}
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
      const getCard = (i) => {
        if (i >= card.subCards.length) {
          this.cards = loadedCards
          if (cardsOnTable.cards) {
            this.currentlyDisplayCards = [...cardsOnTable.cards]
          } else {
            this.displayedCards()
          }
          this.curser = newCurser || 0
          console.log("setCurser", this.curser)
          this.layout(this.root.layout)
          console.log("loaded", cardHash, this.root, this.cards)
          this.setColor()
          cb()
        } else {
          this.loadCard(card.subCards[i], subCard => { // load main cards
            if (!subCard) {
              console.log("No card found on load()", card.subCards[i])
            }
            loadedCards[i] = subCard || {...template(), title: "No card found on load()", smBody: card.subCards[i], fromMemory: true}
            getCard(i + 1)
          })
        }
      }
      getCard(0)
    })
  },
  save(cb = c => c) {
    // save the root card to local storage
    this.saveRoot(this.getPathTop())
    // save this.cards to local storage hash all cards and save under the hash with a list of hashs for sub cards
    this.cards.forEach(card => {
      const subHashes = card.subCards.map(subCard => makeHash(subCard)).filter(hash => !!hash)
      const cardHash = makeHash(card)
      saveCard(cardHash, {...card, subCards: subHashes})
    })
    if (typeof cb === "function") {
      return cb()
    }
  },
  shallower() {
    this.big = true
    const fresh = this.path.pop()
    window.history.pushState({curser: this.curser}, "", "/" + this.path.join("/"))

    const tableCards = historyTable[this.path.length]
    if (tableCards && tableCards.cards && tableCards.cards.length && tableCards.cards[0].hash) {
      this.load(this.path[this.path.length - 1], tableCards.curser, () => {}, tableCards)
    } else {
      this.load(this.path[this.path.length - 1], this.curser)
    }
    console.log("historyTable", historyTable)
    this.big = false
    this.curser = this.cards.reduce((curser, card, index) => {
      if (fresh === makeHash(card)) {
        return index
      } 
      return curser
    }, -1) // imperfect solution (confuses if there is more than one card with the same hash)
    this.layout(this.root.layout)
  },
  deeper(curser, i = -1) {
    this.big = true
    const currentCard = this.cards[this.curser] // this is the card that is being drilled into
    if (!currentCard || currentCard === undefined) return // if null or undefined stop the function
    const newHash = makeHash(currentCard)
    if (this.path[this.path.length - 1] === newHash) return // if the card is already on the path stop the function
    historyTable[this.path.length] = {
      cards: [...this.currentlyDisplayCards], 
      curser: this.currentlyDisplayCards.reduce((curser, card, index) => {
        if (newHash === card.hash) {
          return index
        }
        return curser
      }, i)
    }
    this.path.push(newHash)
    window.history.pushState({}, "", "/" + this.path.join("/"))
    this.load(newHash, curser)

    this.big = false
    console.log("historyTable", historyTable)
  },
  onEnterTitle(){
    if (!this.newCard.title) return
    else return this.inc()
    addDialog.showModal()
    store.disableKeys = true
  },
  lastSwap: 0,
  draggingId: "",
  dragOver(e) {
    e.preventDefault()
    if (this.lastSwap >= (Date.now() - 500)) return;
    //find the card that is being dragged over and the card that is being dragged
    let to = e.target.getAttribute("data-index")
    if (to === null) {
      to = e.target.parentElement.getAttribute("data-index")
    }
    if (to === null) {
      to = e.target.parentElement.parentElement.getAttribute("data-index")
    }
    if (to === null) return
    let from = this.currentlyDisplayCards.reduce((index, card, cardsIndex) => {
      if (card.hash + card.index == this.draggingId) {
        return cardsIndex
      }
      return index
    }, -1)

    if (from === -1) {
      from = this.currentlyDisplayCards.reduce((index, card, cardsIndex) => {
        if (this.draggingId.startsWith(card.hash)) {
          return cardsIndex
        }
        return index
      }, -1)
      console.log("No card found being dragged", this.draggingId)
      if (from === -1) return
    }
    // TODO make sure that the swap is intened.
    if (to == from) return
    if (to == -1) {
      this.makeMainCard(from)
    } else {
      this.lastSwap = Date.now();
      this.swapCards(from, to, false)
      // this.draggingId = this.currentlyDisplayCards[to].hash + to
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
        if (makeHash(card) + index == this.draggingId) {
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
      if (!color) return // console.log("No color")
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
    this.tableLeft = false
    this.tableRight = false
    setTimeout(() => {
      this.setTable()
      if (store.curser !== -1) {
        const currentIndex = store.currentlyDisplayCards.map(card => card.index)
        const card = document.getElementsByClassName("outerMainCard")[currentIndex.indexOf(store.curser)]
        if (card) {
          card.scrollIntoView({behavior: "smooth", block: "center", inline: "nearest"});
          store.setFocus(store.cards[store.curser], currentIndex.indexOf(store.curser))
        }
      } else {
        const root = document.getElementById("root");
        if (root) {
          root.scrollIntoView({behavior: "smooth", block: "start", inline: "start"});
          store.setFocus(store.root, -1)
        }
      }
    }, 500)
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
    if (this.root.slice) {
      this.displayedCards()
    } else {
      this.currentlyDisplayCards = this.currentlyDisplayCards.filter(card => !card.done)
    }
    this.layout(this.root.layout)
    this.save()
  },
  setColor() {
    if (!this.root.color) return
    document.body.style.backgroundColor = this.root.color
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
      this.displayedCards()
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
  removeCard(index, loop = false) {
    // hash is a number or a string
    if (typeof hash === 'number') {
      hash = makeHash(this.cards[index])
    }
    this.cards = this.cards.slice(0, index).concat(this.cards.slice(index + 1))
    // localStorage.removeItem(hash) // need to check if the card is in other cards before removing it

    this.cacheCards = this.cacheCards.filter(card => card.hash !== hash)
    this.currentlyDisplayCards = this.currentlyDisplayCards.filter(card => card.index !== index)
    // update the tableCards
	  //
    historyTable[this.path.length].cards = historyTable[this.path.length].cards.slice(0, index).concat(historyTable[this.path.length].cards.slice(index + 1))
    historyTable[this.path.length].curser = historyTable[this.path.length].curser > index ? historyTable[this.path.length].curser - 1 : historyTable[this.path.length].curser

    if (loop) return 
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
    this.big = false
    window.requestAnimationFrame(() => {
      const openDialog = document.getElementById(dialog)
      if (!openDialog) return console.log("No dialog found", dialog)
      openDialog.showModal()
    })
  },
  deleteOrphanedCards() {
    const root = this.loadCard("root")
    const orphanedCards = this.localCards().filter(card => card.listedByCards === 0)
    if (orphanedCards.length === 0) return alert("No orphaned cards found")
    if (!confirm(`Are you sure you want to delete ${orphanedCards.length} orphaned cards?`)) return
    orphanedCards.forEach(card => {
      store.removeCard(card.hash, true)
    })
    saveCard("root", root) // save the root as we just deleted it.
    this.save()
    alert("Orphaned cards deleted")
    this.displayedCards()
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
      if (this.editingHash === makeHash(this.root)) { // if the editing hash is the root card, update the root card
	
	this.root = {...this.root, ...this.editCard}
	const editingHash = makeHash(this.root)
	if (this.editingHash !== editingHash) { // save forward
          localStorage.setItem(this.editingHash, makeHash(this.editCard))
        }
	const rootHash = makeHash(this.root)
	historyTable = historyTable.map((table, index) => {
          const cards = table.cards.map(card => {
	    if (card.hash === this.editingHash) {
	      return {...this.editCard, hash: rootHash, index: card.index}
	    }
	    return card
	  })
          return {...table, cards}
	})
	
        this.saveRoot(rootHash)
      }
      saveCard(this.editingHash, this.editCard)
    } else {
      this.cards = [...this.cards, {...this.editCard}]
      this.currentlyDisplayCards = this.currentlyDisplayCards.concat([{...this.editCard}])
    }
    this.save()
    this.displayedCards()
    this.layout(this.root.layout)
    if (close) {
      this.closeDialog("addDialog")
      this.closeDialog("editDialog")
    }
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
  loadMemPathEazy(cb = r => r) {
    this.setPath()
    let path = ["root", ...this.path] // add root to the path
    path.forEach((hash, pathIndex) => {
      setTimeout(() => {
        this.load(hash)
      }, pathIndex * 500)
    })
    setTimeout(() => {
      cb()
    }, path.length * 500)
  },
  loadMemPath(cb = r => r) {
    console.log("loading path", this.path)
    // if the path is empty, load the root card
    this.setPath()
    let path = ["root", ...this.path] // add root to the path
    let fetchList = []
    let fetchFun = []
    if (path.length > 1) {
      const getCard = (pathIndex) => { // load the cards in the path one by one
        if (path[pathIndex]) {
          this.loadCard(path[pathIndex], (card) => {
            if (!card) {
              console.log("No card found on loadMemPath", path[pathIndex])
              return getCard(pathIndex + 1)
            }
            //load sub cards
            if (card.source) {
              fetchList.push(card.source)
              console.log(fetchList)
              fetchFun.push(() => {
                fetchCards(card, path[pathIndex], (newCard) => {
                  console.log("fetched", newCard, feedCards)
                  fetchList = fetchList.filter(url => url !== card.source)
                  getCard(pathIndex + 1)
                })
              })
            }
            
            if (pathIndex === 0 && !card) {
              const bace = { ...template(), title: "Sky Cards", body: "A place to keep your cards", source: "https://firebasestorage.googleapis.com/v0/b/sky-cards.appspot.com/o/site%2Fhome.jsonl?alt=media"}
              const hash = makeHash(bace)
              saveCard(hash, bace)
              localStorage.setItem("root", hash)
              return getCard(0) // now that the root card is saved, try again
            }
            if (!card) console.log("No card found", path[pathIndex])
            if (fetchList.length === 0) {
              getCard(pathIndex + 1)
            } else {
              fetchFun[0]()
              console.log("fetching", fetchList[0])
              fetchFun.shift()
            }
          })
        } else {
          console.log("asked for", path, "got", feedCards)
          if (!path[pathIndex+1]) {
            console.log(feedCards, fetchList)
            cb()
          } else {
            getCard(pathIndex + 1)
          }
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
function arrowKeysOn(e) {
  if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return
  if (e.keyCode == 27) {
    store.disableKeys = false //introduces some awkwardness when escape is hit and then typing in a text box
    e.target.blur()
  } 
  if (store.disableKeys) return
  e = e || window.event;
  const currentIndex = store.currentlyDisplayCards.map(card => card.index)
  const currentCard = currentIndex.indexOf(store.curser)
  
  if (e.key == "ArrowUp" || e.key == "w" || e.key == "k") {
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
  if (e.key == "ArrowDown" || e.key == "s" || e.key == "j") {
    if (store.curser == -1) {
      if (currentIndex.length == historyTable[store.path.length]?.cards.length) {
        const table = historyTable[store.path.length]
        const maxIndex = table.cards.length - 1
        const curser = Math.min(+table.curser, maxIndex)
        store.curser = currentIndex[Math.max(curser, 0)]
      } else {
        store.curser = currentIndex[0]
      }
      console.log("curser", store.curser)
    } else {
      store.deeper(-1, currentCard)
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
      store.deeper(currentIndex[currentCard], currentCard)
    }
  }
  if (e.key == "ArrowLeft" || e.key == "a" || e.key == "h" || e.key == "A" || e.key == "H") {
    if (e.shiftKey) {
      if (store.curser !== -1) {
        store.swapCards(currentIndex[currentCard], currentIndex[currentCard - 1])
      }
    } else {
      if (store.curser === -1 && store) {
        if (store.tableLeft) {
	  store.tableLeft()
	}
      } else if (currentIndex[currentCard - 1] === undefined) {
        // do nothing
      } else {
        store.setCurser(Math.max(currentIndex[currentCard - 1], -1))
      }
    }
  }
  if (e.key == "ArrowRight" || e.key == "d" || e.key == "l" || e.key == "D" || e.key == "L") {
    if (e.shiftKey) {
      if (store.curser !== -1) {
        store.swapCards(currentIndex[currentCard], currentIndex[currentCard + 1])
      }
    } else {
      if (store.curser === -1) {
        if (store.tableRight) {
          store.tableRight()
	}
      } else if (currentIndex[currentCard + 1] === undefined) {
      } else {
        store.setCurser(Math.min(currentIndex[currentCard + 1], currentIndex[currentIndex.length - 1]))
      }
    }
  }
  if (e.key === "+") store.openDialog('addDialog') // plus
  if (store.curser > -1 && e.key === "-" && confirm("Delete Card?")) store.removeCard(store.curser) // minus
  store.big = false
  store.layout(store.root.layout)
}
document.onkeydown = arrowKeysOn
createApp({
  // share it with app scopes
  store,
  UpdateDialog,
}).mount()
store.loading = true
store.loadMemPath(() => {
  console.log(store.path)
  console.log({feedCards})
  console.log({combinedCards})
  console.log("loaded", store.root, store.cards)

  store.load("", -1, () => {
    store.setHistoryTable()
    store.loading = false
  })
})
setTimeout(() => {
  document.title = store.root.title
  document.body.style.display = "block"
  store.loading = false
  store.load(store.getPathTop(), -1, () => {
    console.log("loaded", store.root, store.cards)
    store.setHistoryTable()
    store.layout(store.root.layout)
    store.setColor()
    store.displayedCards()
  })
}, 1000)
window.onpopstate = function(e) {
  console.log("pop state", e)
  store.load()
}

window.addEventListener("message", (e) => {
  if (document.getElementById("addDialog").open || e.data.number != 1) {
    if (e.data.file?.type.indexOf('image') !== -1) {
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
