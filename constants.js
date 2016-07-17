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
        TEMPLE: 0,
        NEW: 1,
        PAID: 2, // do not need, this is the same with RUNNING
        RUNNING: 3,
        FINISHED: 4,
        CLOSED: 5, // same as FININSHED
        REMOVED: 6,
    },

    RED_PACKET_USER_VIEWABLE: [1, 2, 3, 4, 5],
};

module.exports = Constants;
