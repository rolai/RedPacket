var publisherAvatarFileId = null;
var redPacketImageFileId = null;
$('.uploadImageControl').on('click', function(e) {
    var field = this.dataset.field;
    wx.chooseImage({
        count: 1, // 默认9
        sizeType: ['compressed'], // 可以指定是原图还是压缩图，默认二者都有
        sourceType: ['album', 'camera'], // 可以指定来源是相册还是相机，默认二者都有
        success: function(res) {
            var localIds = res.localIds; // 返回选定照片的本地ID列表，localId可以作为img标签的src属性显示图片
            wx.uploadImage({
                localId: localIds[0], // 需要上传的图片的本地ID，由chooseImage接口获得
                isShowProgressTips: 1, // 默认为1，显示进度提示
                success: function(res) {
                    var mediaId = res.serverId; // 返回图片的服务器端ID
                    console.log(mediaId);
                    $.post('/uploadFile', {
                            mediaId: mediaId
                        },
                        function(response) {
                            console.log(response);
                            var json = JSON.parse(response).result;
                            if (json.result === true) {
                                if (field == 'publisherAvatar') {
                                    publisherAvatarFileId = json.fileId;
                                    $(this).attr("src", json.fileUrl);
                                    $('.uploadImageControl[data-field="publisherAvatar"]').attr("src", json.fileUrl);
                                } else {
                                    redPacketImageFileId = json.fileId;
                                    $('.uploadImageControl[data-field="redPacketImage"]').attr("src", json.fileUrl);
                                }
                            } else {
                                showMessageBox('出错', json.errorMessage);
                            }
                        }
                    );
                }
            });
        }
    });
});


var allowPay = true;

function redirect(path) {
    var url = window.location.href;
    var index = url.indexOf("/rp/create");
    var targetUrl = url.substring(0, index) + path;
    window.location.href = targetUrl;
}

//调用微信JS api 支付
function jsApiPay(redPacket, signedOrder, wxResponse) {
    console.log(redPacket);
    WeixinJSBridge.invoke(
        'getBrandWCPayRequest',
        signedOrder,
        function(res) {
            WeixinJSBridge.log(res.err_msg);
            allowPay = true;
            if (res.err_msg == "get_brand_wcpay_request:ok") {
                // 使用以上方式判断前端返回,微信团队郑重提示：res.err_msg将在用户支付成功后返回    ok，但并不保证它绝对可靠。
                redirect("/user/events");
            } else {
                showMessageBox('出错', '创建红包失败: ' + json.errorMessage);
                // 支付失败要删除之前创建过的红包，不然会重复创建。
                $.post('/rp/delete', {
                        redPacketId: redPacket.id
                    },
                    function(response) {}
                );
            }
        }
    );
}

// 调用后台生成订单
function createRedPacket(data, payIt) {
    $.post('/rp/update-or-create',
        data,
        function(response) {
            var json = JSON.parse(response);
            if (json.result === true) {
                if (json.needPayMoney > 0) {
                    payIt(json.redPacket, json.signedOrder, json.wxResponse);
                } else {
                    redirect("/user/events");
                }
            } else {
                showMessageBox('出错', '创建红包失败: ' + json.errorMessage);
                allowPay = true;
            }
        }
    );
}

function verfiyInputData() {
    var data = {
        count: parseInt($('#count').val()),
        totalMoney: parseInt($('#totalMoney').val()) * 100,
        adLink: $('#adLink').val(),
        adImageFileId: redPacketImageFileId,
        publisherAvatarFileId: publisherAvatarFileId,
        publisherName: $('#publisherName').val(),
        publisherPhoneNumber: $('#publisherPhoneNumber').val(),
        title: $('#redPacketTitle').val(),
        invalidDate: $('#invalidDate').val()
    };

    if (data.publisherName === '') {
        showMessageBox('出错', '请提供商家名称！');
        return null;
    }

    if (data.publisherPhoneNumber === '') {
        showMessageBox('出错', '请提供商家的联系方式！');
        return null;
    }

    /*
      if(data.publisherAvatarFileId === null) {
        showMessageBox('出错', '请选择商家头像！');
        return null;
      }
    */
    if (data.title === '') {
        showMessageBox('出错', '请提供活动标题！');
        return null;
    }

    if (data.invalidDate === '') {
        showMessageBox('出错', '请选择到期时间！');
        return null;
    }
    /*
      if(data.adImageFileId === null) {
        showMessageBox('出错', '请选择活动图片！');
        return null;
      }
    */
    if (data.adLink === '') {
        showMessageBox('出错', '请提供跳转链接！');
        return null;
    }

    if (data.count === 0 || data.totalMoney === 0) {
        showMessageBox('出错', '请提供红包总额和发放份数！');
        return null;
    }

    if (data.totalMoney / data.count < 30) {
        showMessageBox('出错', '人均红包不得低于0.3元！');
        return null;
    }

    return data;
}

$('#crp-pay-btn').on('click', function(e) {
    if (!allowPay) {
        return;
    }

    if (typeof WeixinJSBridge == "undefined") {
        showMessageBox('出错', '请在微信中访问此页面');
    } else {
        var data = verfiyInputData();
        if (data !== null) {
            if (this.dataset.id != '') data.redPacketId = this.dataset.id;
            allowPay = false;
            createRedPacket(data, jsApiPay);
        }
    }
});

$('#crp-preview-btn').on('click', function(e) {
    var data = verfiyInputData();
    if (data !== null) {
        if (this.dataset.id != '') data.redPacketId = this.dataset.id;
        $.post('/rp/preview',
            data,
            function(response) {
                var json = JSON.parse(response).result;
                if (json.result == true) {
                    redirect("/rp/preview/" + json.redPacket.id);
                } else {
                    showMessageBox('出错', '创建红包失败: ' + json.errorMessage);
                }
            }
        );
    }
});