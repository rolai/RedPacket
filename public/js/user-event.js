var selectedEventId = '';
var selectedEventStatus = 0;
var mask = $('#mask');
var weuiActionsheet = $('#weui_actionsheet');

$('.settings-icon').on('click', function () {
    selectedEventId = this.dataset.id;
    selectedEventStatus = this.dataset.status;
    if(selectedEventStatus == 1) { // new event
      $('#preview-event-btn').hide();
      $('#update-event-btn').show();
      $('#close-event-btn').hide();
      $('#delete-event-btn').hide();
    } else if(selectedEventStatus == 2 || selectedEventStatus == 3) { // running event
      $('#preview-event-btn').show();
      $('#update-event-btn').hide();
      $('#close-event-btn').show();
      $('#delete-event-btn').hide();
    } else { // FINISHED event
      $('#preview-event-btn').show();
      $('#update-event-btn').hide();
      $('#close-event-btn').hide();
      $('#delete-event-btn').show();
    }

    weuiActionsheet.addClass('weui_actionsheet_toggle');
    mask.show()
        .focus()//加focus是为了触发一次页面的重排(reflow or layout thrashing),使mask的transition动画得以正常触发
        .addClass('weui_fade_toggle').one('click', function () {
        hideActionSheet(weuiActionsheet, mask);
    });
    $('#actionsheet_cancel').one('click', function () {
        selectedEventId = '';
        selectedEventStatus = 0;
        hideActionSheet(weuiActionsheet, mask);
    });
    mask.unbind('transitionend').unbind('webkitTransitionEnd');
});

function hideActionSheet(weuiActionsheet, mask) {
    weuiActionsheet.removeClass('weui_actionsheet_toggle');
    mask.removeClass('weui_fade_toggle');
    mask.on('transitionend', function () {
        mask.hide();
    }).on('webkitTransitionEnd', function () {
        mask.hide();
    });
}

function redirect(path) {
    var url = window.location.href;
    var index = url.indexOf("/user/events");
    var targetUrl = url.substring(0, index) + path;
    window.location.href = targetUrl;
}

$('#update-event-btn').on('click', function () {
  if(selectedEventId === '' || selectedEventStatus != 1) {
    hideActionSheet(weuiActionsheet, mask);
  } else {
    redirect("/rp/update/" + selectedEventId);
  }
});

$('#preview-event-btn').on('click', function () {
  if(selectedEventId === '' || selectedEventStatus == 1) {
    hideActionSheet(weuiActionsheet, mask);
    return;
  } else {
    redirect("/rp/status/" + selectedEventId);
  }
});


$('#close-event-btn').on('click', function () {
  if(selectedEventId === '' || (selectedEventStatus != 2 && selectedEventStatus != 3)) {
    hideActionSheet(weuiActionsheet, mask);
  } else {
    $.post('/rp/close',
        {
          redPacketId: selectedEventId
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


$('#delete-event-btn').on('click', function () {
  if(selectedEventId === '' || selectedEventStatus <= 3) {
    hideActionSheet(weuiActionsheet, mask);
  } else {
    $.post('/rp/delete',
        {
          redPacketId: selectedEventId
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
