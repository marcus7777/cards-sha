import { createApp, reactive } from './petite-vue.es.js'
import QrCreator from './qr-creator.es6.min.js';

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
  curser:0,
  cards: [],
  trail: [],
  trailNames: [],
  color: 'white',
  title: '',
  pageTitle: '',

  addStyleToMe(i,setTo){ // work in progress
    const elements = document.getElementsByClassName("outerMainCard")
    elements[i].style.order = setTo
  },
  hash(card){
    return makeHash(card)
  },
  showMain(card, index) {
    // look at the card and decide if it should be shown in the main list
    // trail is the path to the current card
    const topTrail = this.trail.slice(0, -1)[0]
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
    image: "",
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
    saveFile(cards.filter(card => typeof card === "string" ).join("\n"), root.title || this.  pageTitle || this.title || "Sky Cards")
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
    // load cards from local storage
    if (!rootHash) {
      rootHash = 'root'
      this.trail = []
    }
    const fresh = this.trail.indexOf(rootHash)
    
    this.trail = this.trail.slice(0, fresh)
    this.trailNames = this.trailNames.slice(0, fresh)
    
    let rootCard = JSON.parse(localStorage.getItem(rootHash))
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
  },
  saveTofile() {
    const root = [...this.trail].pop() || 'root'
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
  onEnterTitle(){
    if (!this.newCard.title) return
    if (!this.cards[0]) return this.inc()
    document.getElementById("mainOrSunDialog").showModal()
  },
  inc() {
    //const newPostion = this.curser + 1
    //this.curser++
    //this.cards = [...this.cards.slice(0, this.curser), {...this.newCard}, ...this.cards.slice(this.curser)]
    this.curser = this.cards.length
    this.cards = [...this.cards, {...this.newCard}]
    this.newCard.title = ""
    document.getElementById("mainOrSunDialog").close()
    this.save()
  },
  incSub() {
    let card = this.cards[this.curser]
    if (!card.subCards) {
      // check for an already existing card and load its subcards
      const cardCheck = loadCard(makeHash(this.newCard))
      if (cardCheck && cardCheck.subCards) {
        card.subCards = cardCheck.subCards
      } else {
        card.subCards = []
      }
    }
    if (makeHash(card) === makeHash(this.newCard)) {
      document.getElementById("mainOrSunDialog").close()
      return alert("Don't add sub cards that are the same as the main card")
    }
    this.cards.forEach(cardCheck => {
      if (makeHash(card) === makeHash(cardCheck)) {
        cardCheck.subCards = cardCheck.subCards.concat([{...this.newCard}])
      }
    })

    // card.subCards = card.subCards.concat([{...this.newCard}])
    this.newCard.title = ""
    document.getElementById("mainOrSunDialog").close()
    this.save()
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
      this.save()
    }
    if (withFocus) {
      const elements3 = document.getElementsByClassName("outerMainCard")[this.curser].getElementsByClassName("inner");
      elements3[0].focus()
    }
    
    //give focus to the card that was moved
    //swop the cards with a timeout so that the cards are swopped before the focus is given
    window.requestAnimationFrame(() => {
      const elements1 = document.getElementsByClassName("outerMainCard")[index1].getElementsByClassName("inner");
      const card1 = elements1[0]
      const elements2 = document.getElementsByClassName("outerMainCard")[index2].getElementsByClassName("inner");
      const card2 = elements2[0]
      // move cards towards each other
      const card1Left = card1.getBoundingClientRect().left
      const card2Left = card2.getBoundingClientRect().left
      card1.style.transition = "all 0.5s"
      card2.style.transition = "all 0.5s"
      card1.style.transform = `translate(${card2Left - card1Left + "px"})`
      card2.style.transform = `translate(${card1Left - card2Left + "px"})`
      setTimeout(() => {
        card1.style.transition = "none"
	card2.style.transition = "none"
        card1.style.transform = ``
        card2.style.transform = ``
	swap()
        if (withFocus) {
          const elements3 = document.getElementsByClassName("outerMainCard")[this.curser].getElementsByClassName("inner");
          elements3[0].focus()
	}
      }, 600)
    }, 0)

  
    

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
    if (!this.trail[0]) return
    // if (makeHash(...) === )// sub mail not the some)
    const temp = {...this.cards[index]}
    this.removeCard(index)
    this.save()
    this.load(["root", ...this.trail].slice(-2)[0]) //tidy me
    this.cards = this.cards.concat([{...temp}])
  },
  removeCard(index) {
    this.cards.splice(index, 1)
    this.curser = Math.max(0, this.curser -1)
    this.save()
  },
  duplicateCard(index) {
    this.curser++
    this.cards = [...this.cards.slice(0, this.curser), {...this.cards[index]}, ...this.cards.slice(this.curser)]
    this.save()
  },
  log(e) {
    console.log(e)
    const div = document.createElement("div");
    const path = location.protocol + "//" + location.host + location.pathname
    const text = e.target.src.replace(path, "")
    if (text.length < 2000 && text.length > 5) {
      QrCreator.render({
        text,
        radius: 0.5, // 0.0 to 0.5
        ecLevel: 'L', // L, M, Q, H
        fill: '#000',
        background: null, // color or null for transparent
        size: 150,
      }, div)
      e.target.src = div.children[0].toDataURL()
    }

    // e.target.replaceWith(div) // this does not work with petite-vue
    
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

