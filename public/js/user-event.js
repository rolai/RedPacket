var selectedEventId = '';
var selectedEventStatus = 0;
var mask = $('#mask');
var weuiActionsheet = $('#weui_actionsheet');

$('.settings-icon').on('click', function() {
    selectedEventId = this.dataset.id;
    selectedEventStatus = this.dataset.status;
    if (selectedEventStatus == 1) { // new event
        $('#preview-event-btn').hide();
        $('#update-event-btn').show();
        $('#close-event-btn').hide();
        $('#delete-event-btn').hide();
    } else if (selectedEventStatus == 2 || selectedEventStatus == 3) { // running event
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
        .focus() //加focus是为了触发一次页面的重排(reflow or layout thrashing),使mask的transition动画得以正常触发
        .addClass('weui_fade_toggle').one('click', function() {
            hideActionSheet(weuiActionsheet, mask);
        });
    $('#actionsheet_cancel').one('click', function() {
        selectedEventId = '';
        selectedEventStatus = 0;
        hideActionSheet(weuiActionsheet, mask);
    });
    mask.unbind('transitionend').unbind('webkitTransitionEnd');
});

function hideActionSheet(weuiActionsheet, mask) {
    weuiActionsheet.removeClass('weui_actionsheet_toggle');
    mask.removeClass('weui_fade_toggle');
    mask.on('transitionend', function() {
        mask.hide();
    }).on('webkitTransitionEnd', function() {
        mask.hide();
    });
}

function redirect(path) {
    var url = window.location.href;
    var index = url.indexOf("/user/events");
    var targetUrl = url.substring(0, index) + path;
    window.location.href = targetUrl;
}

$('#update-event-btn').on('click', function() {
    if (selectedEventId === '' || selectedEventStatus != 1) {
        hideActionSheet(weuiActionsheet, mask);
    } else {
        redirect("/rp/update/" + selectedEventId);
    }
});

$('#preview-event-btn').on('click', function() {
    if (selectedEventId === '' || selectedEventStatus == 1) {
        hideActionSheet(weuiActionsheet, mask);
        return;
    } else {
        redirect("/rp/status/" + selectedEventId);
    }
});


$('#close-event-btn').on('click', function() {
    if (selectedEventId === '' || (selectedEventStatus != 2 && selectedEventStatus != 3)) {
        hideActionSheet(weuiActionsheet, mask);
    } else {
        $.post('/rp/close', {
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


$('#delete-event-btn').on('click', function() {
    if (selectedEventId === '' || selectedEventStatus <= 3) {
        hideActionSheet(weuiActionsheet, mask);
    } else {
        $.post('/rp/delete', {
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


var page = 1;
var pageSize = 10;

var eventTemplates = '<div class="event-card-container"><a href="<%=url%>"> \
    <div class="event-card-header"> \
    <div class="event-card-header-left"><img src="<%=event.creator.avatar%>"></div> \
    <div class="event-card-header-right"> \
        <div class="mb-5 cl-drak-grey"> \
            <span class="font-xlg"><%=event.creator.nickname%></span>  \
            <%=event.status.tag%> \
        </div> \
        <div class="font-sm cl-grey"><%=event.createdAt%></div> \
    </div></div> \
    <p class="event-title font-xlg cl-drak-grey mt-10"> 【活动】 <%=event.title%></p></a> \
    <div class="setting-icon-container"> \
        <img class="settings-icon" data-id="<%= event.id %>" data-status="<%= event.status %>" src="/public/images/setting-icon.png"> \
    </div></div> ';

var eventEnd = '<span class="event-status-tag bg-grey"> 已结束</span>';
var eventNew = '<span class="event-status-tag bg-yellow"> 未发布 </span>';
var eventRunning = '<span class ="event-status-tag bg-red"> ￥<%=event.totalMoney%></span>';

function addEventItem(event) {
    var url = "/rp/open/" + event.id;
    var eventStatus;
    if (event.status == 1) {
        eventStatus = eventNew;
    } else if (event.status == 2 || event.status == 3) {
        eventStatus = eventRunning.replace("<%=event.totalMoney%>", event.totalMoney / 100.0);
    } else {
        eventStatus = eventEnd;
    }


    var html = eventTemplates.replace("<%=url%>", url)
        .replace("<%=event.creator.avatar%>", event.creator.avatar)
        .replace("<%=event.creator.nickname%>", event.creator.nickname)
        .replace("<%=event.status.tag%>", eventStatus)
        .replace("<%=event.createdAt%>", event.createdAt)
        .replace("<%=event.title%>", event.title);

    $('#events-container').append(html);
}

$('#load-more-btn').on('click', function(e) {
    $.post('/user/events', {
            page: page
        },
        function(response) {
            var json = JSON.parse(response);
            if (json.events) {
                page++;
                json.events.forEach(function(event) {
                    addEventItem(event);
                });

                if (json.events.length < pageSize) {
                    $('#load-more-btn').hide();
                }
            }
        }
    );
});