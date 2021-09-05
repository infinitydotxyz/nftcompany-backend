let totalInterestPaid
let interestPerBlock
let lastRewardBlock
let totalProductivity
let accAmountPerShare
let currentBlock

const users = {
    0xabc: {
        amount: 12,
        rewardDebt: 1
    }
}

// External function call
// This function adjust how many tokens are produced by each block, eg:
// changeAmountPerBlock(100)
// will set the produce rate to 100/block.
function changeInterestRatePerBlock(value) {
    interestPerBlock = value
}

// Update reward variables of the given pool to be up-to-date.
function update() {
    if (currentBlock <= lastRewardBlock) {
        return
    }
    if (totalProductivity == 0) {
        lastRewardBlock = currentBlock
        return
    }
    const multiplier = currentBlock - lastRewardBlock
    const reward = multiplier * interestPerBlock

    accAmountPerShare = accAmountPerShare + (reward / totalProductivity)
    lastRewardBlock = currentBlock
}

// External function call
// This function increase user's productivity and updates the global productivity.
// the users' actual share percentage is calculated by user_productivity / global_productivity
function increaseProductivity(user, value) {
    const userStakeInfo = users[user]
    update()

    let pending
    if (userStakeInfo.amount > 0) {
        pending = (userStakeInfo.amount * accAmountPerShare) - userStakeInfo.rewardDebt
        totalInterestPaid = totalInterestPaid + pending
    }

    totalProductivity = totalProductivity + value

    userStakeInfo.amount = userStakeInfo.amount + value
    userStakeInfo.rewardDebt = userStakeInfo.amount * accAmountPerShare
    //return (true, pending, totalProductivity)
    // store in firestore
}

// External function call 
// This function will decreases user's productivity by value, and updates the global productivity
// it will record which block this is happenning and accumulates the area of (productivity * time)
function decreaseProductivity(user, value) {
    const userStakeInfo = users[user]
    update()

    let pending = userStakeInfo.amount * accAmountPerShare - userStakeInfo.rewardDebt
    totalInterestPaid = totalInterestPaid + pending
    userStakeInfo.amount = userStakeInfo.amount - value
    userStakeInfo.rewardDebt = userStakeInfo.amount * accAmountPerShare
    totalProductivity = totalProductivity - value
    //return (true, pending, totalProductivity)
    // store in firestore
}

function getReward(user) {
    const userStakeInfo = users[user]
    let _accAmountPerShare = accAmountPerShare
    if (currentBlock > lastRewardBlock && totalProductivity != 0) {
        const multiplier = currentBlock - lastRewardBlock
        const reward = multiplier * interestPerBlock
        _accAmountPerShare = _accAmountPerShare + (reward / totalProductivity)
    }
    return (userStakeInfo.amount * _accAmountPerShare) - userStakeInfo.rewardDebt
}

// Returns how much productivity a user has and global has
function getProductivity(user) {
    const data = {
        userProductivity: users[user].amount,
        totalProductivity: totalProductivity
    }
    return data
}

// Returns the current gross product rate.
function interestsPerBlock() {
    return accAmountPerShare
}