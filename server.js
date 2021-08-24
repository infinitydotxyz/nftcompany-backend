const express = require('express')
const app = express();
app.use(express.json())

const utils = require("./utils")

// Listen to the App Engine-specified port, or 9090 otherwise
const PORT = process.env.PORT || 9090;
app.listen(PORT, () => {
    utils.log(`Server listening on port ${PORT}...`)
})

app.get('/', (req, res) => {
    res.send('Hello from server!')
})

app.get('/explore', (req, res) => {
    const items = []
    const item = {}
    item.image = 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg'
    item.title = 'Title'
    item.price = '1 ETH'
    item.numAvailable = '1 in stock'
    item.collectionIcon = 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg'
    item.ownerIcon = 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg'
    item.creatorIcon = 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg'
    item.highestBid = '2 ETH'
    item.timeLeftToBid = '1 hr'
    items.push(item)
    res.send(items)
})

app.get('/explore/item/:item', (req, res) => {
    const item = {}
    item.image = 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg'
    item.title = 'Title'
    item.desc = 'Description'
    item.price = '1 ETH'
    item.numAvailable = '1 in stock'
    item.highestBid = '2 ETH'
    item.highestBidBy = 'abc'
    item.highestProfileIcon = 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg'
    item.timeLeftToBid = '1 hr'

    const info = {
        owner: 'abc',
        creator: 'abc'
    }
    item.info = info

    const owners = [
        {
            name: 'abc',
            profileIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg'
        },
        {
            name: 'abc',
            profileIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg'
        }
    ]
    item.owners = owners

    const history = [
        {
            name: 'abc',
            profileIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            timestamp: 123,
            desc: 'Placed a bid for 1 ETH'
        },
        {
            name: 'abc',
            profileIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            timestamp: 123,
            desc: 'Put Awesome work on sale'
        }
    ]
    item.history = history

    const bids = [
        {
            name: 'abc',
            profileIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            bid: '1.5 ETH'
        },
        {
            name: 'abc',
            profileIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            bid: '1 ETH'
        }
    ]
    item.bids = bids

    res.send(item)
})

app.get('/u/:user', (req, res) => {
    const data = {
        name: 'abc',
        profileIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
        location: 'Paris',
        bio: 'I am an artist',
        url: 'https://mavrik.me',
        socialLinks: {
            twitter: 'https://twitter.com/mavriklabs',
            insta: 'https://instagram.com/mavriklabs'
        },
        memberSince: 'Aug 2021'
    }
    res.send(data)
})

app.get('/u/:user/follows', (req, res) => {
    const following = [
        {
            name: 'abc',
            profileIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            numFollowers: 20,
            images: [
                'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
                'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg'
            ]
        },
        {
            name: 'abc',
            profileIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            numFollowers: 20,
            images: [
                'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
                'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg'
            ]
        }
    ]

    const followers = [
        {
            name: 'abc',
            profileIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            numFollowers: 20,
            images: [
                'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
                'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg'
            ]
        },
        {
            name: 'abc',
            profileIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            numFollowers: 20,
            images: [
                'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
                'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg'
            ]
        }
    ]

    const data = {
        followers: followers,
        following: following
    }

    res.send(data)
})

app.get('/u/:user/items', (req, res) => {
    const data = {}

    const onSale = [
        {
            image: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            title: 'abc',
            price: '1 ETH',
            numAvailable: '1/10 in stock',
            collectionIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            ownerIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            creatorIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            highestBid: '1 ETH',
            timeLeftToBid: '2 hrs'
        },
        {
            image: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            title: 'abc',
            price: '1 ETH',
            numAvailable: '1/10 in stock',
            collectionIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            ownerIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            creatorIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            highestBid: '1 ETH',
            timeLeftToBid: '2 hrs'
        }
    ]
    data.onSale = onSale

    const collected = [
        {
            image: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            title: 'abc',
            price: '1 ETH',
            collectionIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            ownerIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            creatorIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
        },
        {
            image: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            title: 'abc',
            price: '1 ETH',
            collectionIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            ownerIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            creatorIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
        }
    ]
    data.collected = collected

    const created = [
        {
            image: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            title: 'abc',
            price: '1 ETH',
            numAvailable: '1/10 in stock',
            collectionIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            ownerIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            creatorIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
        },
        {
            image: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            title: 'abc',
            price: '1 ETH',
            numAvailable: '1/10 in stock',
            collectionIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            ownerIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            creatorIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
        }
    ]
    data.created = created

    const likes = [
        {
            image: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            title: 'abc',
            price: '1 ETH',
            numAvailable: '1/10 in stock',
            collectionIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            ownerIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            creatorIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            highestBid: '1 ETH',
            timeLeftToBid: '2 hrs'
        },
        {
            image: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            title: 'abc',
            price: '1 ETH',
            numAvailable: '1/10 in stock',
            collectionIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            ownerIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            creatorIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            highestBid: '1 ETH',
            timeLeftToBid: '2 hrs'
        }
    ]
    data.likes = likes

    res.send(data)
})

app.get('/u/:user/item/:item', (req, res) => {
    const item = {}
    item.image = 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg'
    item.title = 'Title'
    item.desc = 'Description'

    const info = {
        owner: 'abc',
        creator: 'abc'
    }
    item.info = info

    const history = [
        {
            name: 'abc',
            profileIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            timestamp: 123,
            desc: 'Placed a bid for 1 ETH'
        },
        {
            name: 'abc',
            profileIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            timestamp: 123,
            desc: 'Put Awesome work on sale'
        }
    ]
    item.history = history

    const bids = [
        {
            name: 'abc',
            profileIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            bid: '1.5 ETH'
        },
        {
            name: 'abc',
            profileIcon: 'https://ui8-crypter-nft-html.herokuapp.com/img/content/card-pic-1.jpg',
            bid: '1 ETH'
        }
    ]
    item.bids = bids

    res.send(item)
})