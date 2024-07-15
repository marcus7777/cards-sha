import { createApp, reactive } from './petite-vue.es.js'

function makeHash(card) {
  if (!card) return
  if (typeof card === 'string') {
    return card
  }
  let obj = {...card}; //clones cards so that it can be manipulated without effecting the original let is a local variable
  delete obj.subCards; //
  const str = JSON.stringify(obj);
  let hash = 0;
  if (str.length == 0) { //returns 0 (maybe useless?)
    return hash;
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
    const cards = e.target.result.split("\n").map(card => JSON.parse(card))
    cards.forEach(card => {
      localStorage.setItem(makeHash(card), JSON.stringify(card))
    })
    cb({ title: "title", body: "body", ...cards[0]})
  }
  reader.readAsText(file)          
}
function saveFile(text, title) {
  const link = document.createElement("a");
  const file = new Blob([text], { type: 'text/plain' });
  link.href = URL.createObjectURL(file);
  link.download = title+".jsonl";
  link.click();
  URL.revokeObjectURL(link.href);
}
// swop the order of the cards
const store = reactive({ //updates the html immediately
  cards: [],
  trail: [],
  trailNames: [],
  color: 'white',
  title: '',
  pageTitle: '',
  hash(card){
    return makeHash(card)
  },
  showMain(card, index) {
    // look at the card and decide if it should be shown in the main list
    // trail is the path to the current card
    console.log(card)
    console.log(index)
    console.log(this.trail)
    const topTrail = this.trail.slice(0, -1)[0]
    console.log(localStorage.getItem( topTrail ))
    return true
  },
  newCard: {
    title: "", 
    body: "",
    subCards: [], // array of cards
    cardAdittions: [], // array of card adittions (like rel, position, color, etc)
    done: false,
    color: '#55c2c3',
    hideDone: false,
    showNext: 0, // show next cards in the list (0 = all, 1 = next, 2 = next and next)
  },
  saveRoot() {
    const rootHash = [...this.trail].pop() || 'root'
    const rootCard = this.loadCard(rootHash)
    rootCard.subCards = this.cards.map(card => makeHash(card))
    if (rootHash === 'root') {
      rootCard.title = this.pageTitle
    }
    localStorage.setItem(rootHash, JSON.stringify(rootCard))
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
        hashes.push( makeHash(subCard) )
      }
      return hashes = hashes.concat(this.getAllHashesNeededFrom(subCard))
    })
    return hashes
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
      cards.push(localStorage.getItem(hash))
    })
    saveFile(cards.filter(card => typeof card === "string" ).join("\n"), root.title)
  },
  uploadFileInToCard(index) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.jsonl'
    input.onchange = (e) => {
      savesToLocalStorage(e.target.files[0], (card) => {
        this.cards[index].subCards = this.cards[index].subCards.concat([card])
      })
    }
    input.click()
  },
  
  save() {
    this.saveRoot()
    // save this.cards to local storage hash all cards and save under the hash with a list of hashs for sub cards
    this.cards.forEach(card => {
      if (typeof card === 'string') {
        card = JSON.parse(localStorage.getItem(card))
      }
      if (!card.subCards) {
        card.subCards = []
      }
      const subHashes = card.subCards.map(subCard => makeHash(subCard))
      card.subCards.forEach(subCard => {
        if (typeof subCard !== 'string') {
          localStorage.setItem( makeHash(subCard), JSON.stringify(subCard))
        }
      })
      const cardHash = makeHash(card)
      
      localStorage.setItem(cardHash, JSON.stringify({...card, subCards: subHashes}))
    })
    console.log('saved')
  },
  saveTofile() {
    const root = [...this.trail].pop() || 'root'
    console.log(root)
    console.log(this.getAllHashesNeededFrom(root))
  },
  setColor() {
    const root = [...this.trail].pop() || 'root'
    const cardToSave = this.loadCard(root)
    localStorage.setItem(root, JSON.stringify({...cardToSave, color: this.color}))

    if (!this.color) {
      this.color = 'white'
    }
    if (this.cards[this.curser]) {
      this.cards[this.curser].color = this.color
    }
    document.body.style.backgroundColor = this.color || 'white'
  },
  deeper(newCurser) {
    this.save()
    this.trail.push(makeHash(this.cards[this.curser]))
    this.trailNames.push(this.cards[this.curser].title)

    window.scrollTo(0, 0)
    window.history.pushState({}, '', `#${this.trail.join('/')}`)
    document.title = this.cards[this.curser].title
    this.title = this.cards[this.curser].title
    this.color = this.cards[this.curser].color
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

    let card = JSON.parse(localStorage.getItem(hash))
    
    if (!card.subCards) {
      card.subCards = []
    }
    card.subCards = card.subCards.map(subHash => {
      if (!subHash) return
      if (typeof subHash === 'string') {
        return JSON.parse(localStorage.getItem(subHash))
      }
      return subHash
    })  
    return card
  },
  load(rootHash) {
    console.log(rootHash)
    // load cards from local storage
    if (!rootHash) {
      rootHash = 'root'
      this.trail = []
    }
    const fresh = this.trail.indexOf(rootHash)
    console.log(fresh)
    
    this.trail = this.trail.slice(0, fresh)
    this.trailNames = this.trailNames.slice(0, fresh)
    
    let rootCard = JSON.parse(localStorage.getItem(rootHash))
    console.log(rootCard, "a")
    if (!rootCard) {
      rootCard = {...this.newCard}
      localStorage.setItem(rootHash, JSON.stringify(rootCard))
    }
    if (!rootCard.subCards) {
      rootCard.subCards = []
    }
    this.color = rootCard.color
    this.pageTitle = rootCard.title
    this.title = rootCard.title
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
  },
  curser:0,
  inc() {
    this.curser = this.cards.length
    this.cards.push({...this.newCard})
  },
  incSub() {
    console.log(this)
    console.log(this.cards[this.curser])
    let card = this.cards[this.curser]
    if (!card.subCards) {
      card.subCards = []
    }
    card.subCards = card.subCards.concat([{...this.newCard}])
  },
  autoAdd() {
    // If the new card title end with add, then add it as a new card.
    // And select all within the text box, so you can start typing the new card title
    const triggerArray = ['. add', '. ad' , 'full stop add', 'full stop at', ". dad", "full stop next", ". Next", ". next"]
    triggerArray.forEach(trigger => {
      if (this.newCard.title.includes(trigger) && this.newCard.title.indexOf(trigger) === this.newCard.title.length - trigger.length){
        this.newCard.title = this.newCard.title.slice(0, -trigger.length)
        this.inc() 
        this.newCard.title = ''
        //document.getElementById('title').select() // this does not work on my Chromebook whilst dictating so not using it to Four now
      }
    })
    const triggerArraySub = ['. sub', 'full stop sub']
    triggerArraySub.forEach(trigger => {
      if (this.newCard.title.includes(trigger) && this.newCard.title.indexOf(trigger) === this.newCard.title.length - trigger.length){
        this.newCard.title = this.newCard.title.slice(0, -trigger.length)
        this.incSub() 
        this.newCard.title = ''
        //document.getElementById('title').select() // this does not work on my Chromebook whilst dictating so not using it to Four now
      }
    })
  },
  swapCards(index1, index2) {
    if (this.curser === index1) {
      this.curser = index2
    } else if (this.curser === index2) {
      this.curser = index1
    }
    const temp = store.cards[index1]
    store.cards[index1] = store.cards[index2]
    store.cards[index2] = temp
  },
  makeSubCard(index1, index2) {
    if (this.curser === index1) {
      this.curser = index2
    } else if (this.curser === index2) {
      this.curser = index1
    }
    const temp = store.cards[index1]
    store.cards[index2].subCards = store.cards[index2].subCards.concat([temp])
    this.removeCard(index1)
  },
  removeCard(index) {
    store.cards.splice(index, 1)
  },
  duplicateCard(index) {
    store.cards = store.cards.concat([{...store.cards[index]}])
  },
})


createApp({
  // share it with app scopes
  store
}).mount()
store.load()
setInterval(() => {
  store.autoAdd()
}, 1000)

