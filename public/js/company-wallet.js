var page = 1;
var pageSize = 10;

var cashFlowTemplates = '<div class="font-lg mt-10"><%=item.info%></div> \
  <div class="font-sm mt-5"> \
    <span class="cl-yellow"><%=item.createdAt%></span> \
    <span class="cl-red" style="float:right"><%=item.cash%>元</span> \
  </div>';


function addCashFlowItem(item) {
    var html = cashFlowTemplates.replace("<%=item.info%>", item.info)
        .replace("<%=item.createdAt%>", item.createdAt)
        .replace("<%=item.cash%>", item.cash / 100.0);

    $('#event-container').append(html);
}

$('#load-more-btn').on('click', function(e) {
    $.post('/user/company-cash-flow', {
            page: page
        },
        function(response) {
            var json = JSON.parse(response);
            if (json.cashFlows) {
                page++;
                json.cashFlows.forEach(function(cashFlow) {
                    addCashFlowItem(cashFlow);
                });

                if (json.cashFlows.length < pageSize) {
                    $('#load-more-btn').hide();
                }
            }
        }
    );
});