$('#rp-action-btn').on('click', function(e) {
    var status = this.dataset.status;
    var redPackeId = this.dataset.id;
    if (!redPackeId) return;

    if (status == 3) {
        $.post('/rp/close', {
                redPacketId: redPackeId
            },
            function(response) {
                var json = JSON.parse(response).result;
                if (json.result === true) {
                    location.reload();
                } else {
                    showMessageBox('出错', json.errorMessage);
                    allowPay = true;
                }
            }
        );
    } else if (status > 3) {
        $.post('/rp/delete', {
                redPacketId: redPackeId
            },
            function(response) {
                var json = JSON.parse(response).result;
                if (json.result === true) {
                    location.reload();
                } else {
                    showMessageBox('出错', json.errorMessage);
                    allowPay = true;
                }
            }
        );
    }
});