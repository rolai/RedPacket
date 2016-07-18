function getRedPacketIdFromUrl(url) {
  if (!url) url = window.location.href;
  var index  = url.lastIndexOf('/');
  var urlPatt = /(\w+)/;
  var res = urlPatt.exec(url.substring(index + 1));
  return res !== null ? res[1] : "";
}

function resetRedPacketPosition() {
  var height = $(window).height();
  var redPacketHeight = $("#rp-overview").height();
  var redPacketPositionY = (height - redPacketHeight) / 2;
  $("#rp-overview").css('top', redPacketPositionY + 'px');
}

resetRedPacketPosition ();

function openRedPacket(money, redPacket) {
  var luckMoney = money / 100.0;
  var message = "已有" + (redPacket.count - redPacket.leftCount) + "人获得  丨  赏金剩余" + (redPacket.leftMoney / 100.0) + "元"
  $("#rd-money").text(luckMoney + '元');
  $("#rp-status-message").text(message);
}

$('.open-rp-btn').on('click', function(e) {
  $.post('/rp/open' , {
      redPacketId: getRedPacketIdFromUrl()
    },
    function(response){
      var json = JSON.parse(response).result;
      if(json.result === true) {
        openRedPacket(json.money, json.redPacket);
        $('#rp-overview').hide();
        $('#rp-details').show();
      } else {
        showMessageBox('出错', json.errorMessage);
      }
    }
  );
});

$('#rp-share-btn').on('click', function(e) {
  showShareTips();
});
