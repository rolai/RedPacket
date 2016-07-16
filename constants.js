var Constants = {
    ROLE: {
        USER: 1,
        SHOP: 2,
        ADMIN: 3
    },

    CASH_FLOW: {
        INCOME: 1, // 抢红包
        SPEND: 2, // 发红包
        WITHDRAW: 3, // 提现
        CHARGE: 4, // 充值
        PAYBACK: 5, // 退回红包余额
    },

    RED_PACKET_STATUS: {
        NEW: 1,
        PAID: 2,
        RUNNING: 3,
        FINISHED: 4,
        CANCELED: 5,
        REMOVED: 6,
    }
};

module.exports = Constants;