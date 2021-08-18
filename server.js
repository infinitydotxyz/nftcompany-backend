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
    item.image = 'https://nftcompany.com/img/ex.png'
    item.title = 'Title'
    item.price = '1 ETH'
    item.numAvailable = '1 in stock'
    item.collectionIcon = 'https://nftcompany.com/img/ex.png'
    item.ownerIcon = 'https://nftcompany.com/img/ex.png'
    item.creatorIcon = 'https://nftcompany.com/img/ex.png'
    item.highestBid = '2 ETH'
    item.timeLeftToBid = '1 hr'
    items.push(item)
    res.send(items)
})

app.get('/explore/item/:item', (req, res) => {
    const item = {}
    item.image = 'https://nftcompany.com/img/ex.png'
    item.title = 'Title'
    item.desc = 'Description'
    item.price = '1 ETH'
    item.numAvailable = '1 in stock'
    item.highestBid = '2 ETH'
    item.highestBidBy = 'abc'
    item.highestProfileIcon = 'https://nftcompany.com/img/ex.png'
    item.timeLeftToBid = '1 hr'

    const info = {
        owner: 'abc',
        creator: 'abc'
    }
    item.info = info

    const owners = [
        {
            name: 'abc',
            profileIcon: 'https://nftcompany.com/img/ex.png'
        },
        {
            name: 'abc',
            profileIcon: 'https://nftcompany.com/img/ex.png'
        }
    ]
    item.owners = owners

    const history = [
        {
            name: 'abc',
            profileIcon: 'https://nftcompany.com/img/ex.png',
            timestamp: 123,
            desc: 'Placed a bid for 1 ETH'
        },
        {
            name: 'abc',
            profileIcon: 'https://nftcompany.com/img/ex.png',
            timestamp: 123,
            desc: 'Put Awesome work on sale'
        }
    ]
    item.history = history

    const bids = [
        {
            name: 'abc',
            profileIcon: 'https://nftcompany.com/img/ex.png',
            bid: '1.5 ETH'
        },
        {
            name: 'abc',
            profileIcon: 'https://nftcompany.com/img/ex.png',
            bid: '1 ETH'
        }
    ]
    item.bids = bids

    res.send(item)
})

app.get('/u/:user', (req, res) => {
    const data = {
        name: 'abc',
        profileIcon: 'https://nftcompany.com/img/ex.png',
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
            profileIcon: 'https://nftcompany.com/img/ex.png',
            numFollowers: 20,
            images: [
                'https://nftcompany.com/img/ex.png',
                'https://nftcompany.com/img/ex.png'
            ]
        },
        {
            name: 'abc',
            profileIcon: 'https://nftcompany.com/img/ex.png',
            numFollowers: 20,
            images: [
                'https://nftcompany.com/img/ex.png',
                'https://nftcompany.com/img/ex.png'
            ]
        }
    ]

    const followers = [
        {
            name: 'abc',
            profileIcon: 'https://nftcompany.com/img/ex.png',
            numFollowers: 20,
            images: [
                'https://nftcompany.com/img/ex.png',
                'https://nftcompany.com/img/ex.png'
            ]
        },
        {
            name: 'abc',
            profileIcon: 'https://nftcompany.com/img/ex.png',
            numFollowers: 20,
            images: [
                'https://nftcompany.com/img/ex.png',
                'https://nftcompany.com/img/ex.png'
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
            image: 'https://nftcompany.com/img/ex.png',
            title: 'abc',
            price: '1 ETH',
            numAvailable: '1/10 in stock',
            collectionIcon: 'https://nftcompany.com/img/ex.png',
            ownerIcon: 'https://nftcompany.com/img/ex.png',
            creatorIcon: 'https://nftcompany.com/img/ex.png',
            highestBid: '1 ETH',
            timeLeftToBid: '2 hrs'
        },
        {
            image: 'https://nftcompany.com/img/ex.png',
            title: 'abc',
            price: '1 ETH',
            numAvailable: '1/10 in stock',
            collectionIcon: 'https://nftcompany.com/img/ex.png',
            ownerIcon: 'https://nftcompany.com/img/ex.png',
            creatorIcon: 'https://nftcompany.com/img/ex.png',
            highestBid: '1 ETH',
            timeLeftToBid: '2 hrs'
        }
    ]
    data.onSale = onSale

    const collected = [
        {
            image: 'https://nftcompany.com/img/ex.png',
            title: 'abc',
            price: '1 ETH',
            collectionIcon: 'https://nftcompany.com/img/ex.png',
            ownerIcon: 'https://nftcompany.com/img/ex.png',
            creatorIcon: 'https://nftcompany.com/img/ex.png',
        },
        {
            image: 'https://nftcompany.com/img/ex.png',
            title: 'abc',
            price: '1 ETH',
            collectionIcon: 'https://nftcompany.com/img/ex.png',
            ownerIcon: 'https://nftcompany.com/img/ex.png',
            creatorIcon: 'https://nftcompany.com/img/ex.png',
        }
    ]
    data.collected = collected

    const created = [
        {
            image: 'https://nftcompany.com/img/ex.png',
            title: 'abc',
            price: '1 ETH',
            numAvailable: '1/10 in stock',
            collectionIcon: 'https://nftcompany.com/img/ex.png',
            ownerIcon: 'https://nftcompany.com/img/ex.png',
            creatorIcon: 'https://nftcompany.com/img/ex.png',
        },
        {
            image: 'https://nftcompany.com/img/ex.png',
            title: 'abc',
            price: '1 ETH',
            numAvailable: '1/10 in stock',
            collectionIcon: 'https://nftcompany.com/img/ex.png',
            ownerIcon: 'https://nftcompany.com/img/ex.png',
            creatorIcon: 'https://nftcompany.com/img/ex.png',
        }
    ]
    data.created = created

    const likes = [
        {
            image: 'https://nftcompany.com/img/ex.png',
            title: 'abc',
            price: '1 ETH',
            numAvailable: '1/10 in stock',
            collectionIcon: 'https://nftcompany.com/img/ex.png',
            ownerIcon: 'https://nftcompany.com/img/ex.png',
            creatorIcon: 'https://nftcompany.com/img/ex.png',
            highestBid: '1 ETH',
            timeLeftToBid: '2 hrs'
        },
        {
            image: 'https://nftcompany.com/img/ex.png',
            title: 'abc',
            price: '1 ETH',
            numAvailable: '1/10 in stock',
            collectionIcon: 'https://nftcompany.com/img/ex.png',
            ownerIcon: 'https://nftcompany.com/img/ex.png',
            creatorIcon: 'https://nftcompany.com/img/ex.png',
            highestBid: '1 ETH',
            timeLeftToBid: '2 hrs'
        }
    ]
    data.likes = likes

    res.send(data)
})

app.get('/u/:user/item/:item', (req, res) => {
    const item = {}
    item.image = 'https://nftcompany.com/img/ex.png'
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
            profileIcon: 'https://nftcompany.com/img/ex.png',
            timestamp: 123,
            desc: 'Placed a bid for 1 ETH'
        },
        {
            name: 'abc',
            profileIcon: 'https://nftcompany.com/img/ex.png',
            timestamp: 123,
            desc: 'Put Awesome work on sale'
        }
    ]
    item.history = history

    const bids = [
        {
            name: 'abc',
            profileIcon: 'https://nftcompany.com/img/ex.png',
            bid: '1.5 ETH'
        },
        {
            name: 'abc',
            profileIcon: 'https://nftcompany.com/img/ex.png',
            bid: '1 ETH'
        }
    ]
    item.bids = bids

    res.send(item)
})