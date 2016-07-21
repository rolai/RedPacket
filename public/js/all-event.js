var page = 1;
var pageSize = 10;

var eventTemplates = '<div class="event-card-container"><a href="<%=url%>"> \
    <div class="event-card-header"> \
    <div class="event-card-header-left"><img src="<%=event.creator.avatar%>"></div> \
    <div class="event-card-header-right"> \
        <div class="mb-5 cl-drak-grey"> \
            <span class="font-xlg"><%=event.creator.nickname%></span>  \
            <span class="event-status-tag bg-red"> ￥<%=event.totalMoney%></span> \
        </div> \
        <div class="font-sm cl-grey"><%=event.createdAt%></div> \
    </div></div> \
    <p class="event-title font-xlg cl-drak-grey mt-10"> 【活动】 <%=event.title%></p></a></div>';

function addEventItem(event) {
    var url = "/rp/open/" + event.id;
    var html = eventTemplates.replace("<%=url%>", url)
        .replace("<%=event.creator.avatar%>", event.creator.avatar)
        .replace("<%=event.creator.nickname%>", event.creator.nickname)
        .replace("<%=event.totalMoney%>", event.totalMoney / 100.0)
        .replace("<%=event.createdAt%>", event.createdAt)
        .replace("<%=event.title%>", event.title);

    // html = "<p>" + event.title + "</p>";
    $('#events-section-container').append(html);
}

$('#load-more-btn').on('click', function(e) {
    $.post('/all-events', {
            page: page
        },
        function(response) {
            var json = JSON.parse(response);
            if (json.redPackets) {
                page++;
                json.redPackets.forEach(function(redPacket) {
                    addEventItem(redPacket);
                });

                if (json.redPackets.length < pageSize) {
                    $('#load-more-btn').hide();
                }
            }
        }
    );
});