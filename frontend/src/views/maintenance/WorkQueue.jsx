import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Wrench, CheckSquare, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/common/PageHeader';
import { PageTransition } from '../../components/common/PageTransition';
import { ChartsRow, DonutCard, BarCard } from '../../components/common/DashboardCharts';
import { QueueViewCards } from '../../components/maintenance/QueueViewCards';
import { WorkQueueToolbar } from '../../components/maintenance/WorkQueueToolbar';
import { WorkOrderCard } from '../../components/maintenance/WorkOrderCard';
import { WorkOrderDialogs } from '../../components/maintenance/WorkOrderDialogs';
import {
  QUEUE_VIEWS,
  LEGACY_TAB_VIEW,
  buildMyQueue,
  buildAssigneeOptions,
  compareBySort,
  toStatusSlug
} from '../../components/maintenance/queueConfig';

const DEFAULT_FILTERS = {
  search: '',
  category: 'all',
  urgency: 'all',
  status: 'all',
  assignee: 'all',
  sort: 'priority'
};

const EMPTY_FLAG_FORM = {
  reason: '',
  itemSpecs: '',
  scheduledWork: '',
  scheduledDate: '',
  scheduledTime: ''
};

/* ==========================================================================
   Maintenance Work Queue
   One page replaces the former "Assigned Requests", "Urgent Queue" and
   "Completed Work Logs" screens. The queue cards at the top are the saved
   views, the toolbar underneath holds every filter on a single horizontal
   row, and one shared card list renders whichever view is selected.
   ========================================================================== */
export const WorkQueue = ({ activeTab = 'tech-tasks', onTabChange }) => {
  const { currentUser } = useAuth();
  const {
    requisitions,
    updateRequisitionStatus,
    updateRequisitionForm,
    raiseMaintenanceFlag,
    raiseReplacementFlag,
    evaluations,
    focusedTicketRef,
    setFocusedTicketRef,
    ticketSearch,
    setTicketSearch
  } = useData();

  const technicianName = currentUser?.name || 'Mark Villanueva (Lead Specialist)';

  /* ---- View (saved queue) state, with legacy tab ids mapped in ---- */
  const [viewId, setViewId] = useState(() => LEGACY_TAB_VIEW[activeTab] || 'all');

  useEffect(() => {
    const legacyView = LEGACY_TAB_VIEW[activeTab];
    if (legacyView) {
      setViewId(legacyView);
      // Normalise the tab so the retired screens stop being separately addressable.
      onTabChange?.('tech-tasks');
    }
  }, [activeTab, onTabChange]);

  // Deep link: a clicked notification stores its ticket ref here
  useEffect(() => {
    if (!focusedTicketRef) return;
    const refStr = String(focusedTicketRef || '').trim();
    const found = (requisitions || []).find(r =>
      String(r.controlNo || '') === refStr ||
      String(r.id || '') === refStr ||
      String(r.ticket_no || '') === refStr
    );
    if (found) {
      setSelectedTask(found);
      setActiveDialog('detail');
    }
    setFocusedTicketRef(null);
  }, [focusedTicketRef, requisitions, setFocusedTicketRef]);

  /* ---- Filters (search is shared with the global navbar search) ---- */
  const [localSearch, setLocalSearch] = useState(DEFAULT_FILTERS.search);
  const [categoryFilter, setCategoryFilter] = useState(DEFAULT_FILTERS.category);
  const [urgencyFilter, setUrgencyFilter] = useState(DEFAULT_FILTERS.urgency);
  const [statusFilter, setStatusFilter] = useState(DEFAULT_FILTERS.status);
  const [assigneeFilter, setAssigneeFilter] = useState(DEFAULT_FILTERS.assignee);
  const [sortOrder, setSortOrder] = useState(DEFAULT_FILTERS.sort);

  const handleViewChange = (nextView) => {
    setViewId(nextView);
    setActionMessage('');
    // The saved views overlap the status filter — keep the two in sync so the
    // toolbar can never contradict the view the technician is looking at.
    if (nextView === 'completed') setStatusFilter('completed');
    else if (nextView === 'in-progress') setStatusFilter('ongoing');
    else if (statusFilter === 'completed' || statusFilter === 'ongoing') setStatusFilter('all');
  };

  // The navbar search box and this toolbar are the same field — one query,
  // two entry points, so results can never disagree.
  const searchTerm = localSearch || ticketSearch || '';
  const handleSearchChange = (value) => {
    setLocalSearch(value);
    setTicketSearch(value);
  };

  const handleResetFilters = () => {
    setLocalSearch('');
    setTicketSearch('');
    setCategoryFilter('all');
    setUrgencyFilter('all');
    setStatusFilter('all');
    setAssigneeFilter('all');
    setSortOrder(DEFAULT_FILTERS.sort);
  };

  /* ---- Dialog + form state ---- */
  const [dialog, setDialog] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const [actionMessage, setActionMessage] = useState('');

  const [targetStatus, setTargetStatus] = useState('Ongoing');
  const [technicianNotes, setTechnicianNotes] = useState('');
  const [materialsUsed, setMaterialsUsed] = useState('');
  const [hoursSpent, setHoursSpent] = useState('');
  const [completionPhoto, setCompletionPhoto] = useState(null);

  const [flagType, setFlagType] = useState('Replacement');
  const [flagForm, setFlagForm] = useState(EMPTY_FLAG_FORM);

  const closeDialog = useCallback((next) => {
    setDialog(next || null);
  }, []);

  /* ---- Data shaping ---- */
  const myQueue = useMemo(
    () => buildMyQueue(requisitions, currentUser),
    [requisitions, currentUser]
  );

  const viewCounts = useMemo(
    () =>
      QUEUE_VIEWS.reduce((acc, v) => {
        acc[v.id] = myQueue.filter(v.filter).length;
        return acc;
      }, {}),
    [myQueue]
  );

  const assignees = useMemo(() => buildAssigneeOptions(myQueue), [myQueue]);

  const evaluationScoreByKey = useMemo(() => {
    const map = new Map();
    (evaluations || []).forEach((e) => {
      const scores = [
        e.functionalSuitability,
        e.usability,
        e.reliability,
        e.performanceEfficiency,
        e.security
      ].filter(Boolean);
      if (!scores.length) return;
      const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
      if (e.reqId != null) map.set(e.reqId, avg);
      if (e.controlNo) map.set(e.controlNo, avg);
    });
    return map;
  }, [evaluations]);

  const activeView = useMemo(
    () => QUEUE_VIEWS.find((v) => v.id === viewId) || QUEUE_VIEWS[0],
    [viewId]
  );

  const visibleTasks = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();

    return myQueue
      .filter(activeView.filter)
      .filter((task) => {
        const matchesSearch =
          !needle ||
          String(task.controlNo || task.id || '').toLowerCase().includes(needle) ||
          String(task.title || '').toLowerCase().includes(needle) ||
          String(task.location || '').toLowerCase().includes(needle) ||
          String(task.requestedBy || '').toLowerCase().includes(needle) ||
          String(task.assignedTo || '').toLowerCase().includes(needle);

        const matchesCategory = categoryFilter === 'all' || task.category === categoryFilter;
        const matchesUrgency = urgencyFilter === 'all' || task.urgency === urgencyFilter;
        const matchesAssignee =
          assigneeFilter === 'all' ||
          String(task.assignedTo || '').trim().toLowerCase() === assigneeFilter.toLowerCase();
        const matchesStatus =
          statusFilter === 'all' ||
          toStatusSlug(task.status) === statusFilter ||
          (statusFilter === 'ongoing' && (task.status === 'Ongoing' || task.status === 'In Progress'));

        return matchesSearch && matchesCategory && matchesUrgency && matchesAssignee && matchesStatus;
      })
      .sort((a, b) => compareBySort(sortOrder, a, b));
  }, [
    myQueue,
    activeView,
    searchTerm,
    categoryFilter,
    urgencyFilter,
    assigneeFilter,
    statusFilter,
    sortOrder
  ]);

  const viewTaskCount = viewCounts[activeView.id] ?? 0;

  /* ---- Deep link: a notification click opens that exact work order ---- */
  useEffect(() => {
    if (!focusedTicketRef) return;
    const found = (requisitions || []).find(
      (r) =>
        r.controlNo === focusedTicketRef ||
        r.id === focusedTicketRef ||
        r.ticket_no === focusedTicketRef
    );
    if (found) {
      setActiveTask(found);
      setDialog('detail');
    }
    setFocusedTicketRef(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedTicketRef]);

  /* ---- Actions ---- */
  const handleQuickStartWork = (task) => {
    const logNote = `Technician ${technicianName} started on-site maintenance assessment at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
    updateRequisitionStatus(task.id, 'Ongoing', technicianName, logNote);
    setActionMessage(`${task.controlNo || task.id} work started successfully.`);
  };

  const handleOpenStatusDialog = (task) => {
    setActiveTask(task);
    setTargetStatus(task.status === 'Pending' || task.status === 'Approved' ? 'Ongoing' : task.status);
    setTechnicianNotes(task.notes || '');
    setMaterialsUsed(task.materialsUsed || '');
    setHoursSpent(task.hoursSpent || '');
    setCompletionPhoto(task.completionPhotoUrl || null);
    setDialog('status');
  };

  const handleSaveTaskStatus = () => {
    if (!activeTask) return;
    // Completed records are locked — the service record must stay immutable.
    if (activeTask.status === 'Completed') {
      setActionMessage(`${activeTask.controlNo || activeTask.id} is already completed and cannot be changed.`);
      setDialog(null);
      return;
    }

    let finalNotes = technicianNotes || `Work performed on-site by ${technicianName}.`;
    if (materialsUsed) finalNotes += ` [Materials: ${materialsUsed}]`;
    if (hoursSpent) finalNotes += ` [Time: ${hoursSpent}]`;

    updateRequisitionStatus(activeTask.id, targetStatus, technicianName, finalNotes);
    if (completionPhoto) {
      updateRequisitionForm(activeTask.id, { completionPhotoUrl: completionPhoto });
    }
    setActionMessage(`${activeTask.controlNo || activeTask.id} work log saved successfully.`);
    setDialog(null);
  };

  const handleOpenFlagDialog = (task) => {
    setActiveTask(task);
    setFlagType(task.maintenanceFlag?.type || 'Replacement');
    setFlagForm({
      reason:
        task.replacementFlag?.reason ||
        task.maintenanceFlag?.reason ||
        'Internal mechanical breakdown; repair costs exceed replacement threshold.',
      itemSpecs: task.replacementFlag?.itemSpecs || 'Standard ISAT U Specifications Unit',
      scheduledWork: task.maintenanceFlag?.scheduledWork || '',
      scheduledDate: task.maintenanceFlag?.scheduledDate || '',
      scheduledTime: task.maintenanceFlag?.scheduledTime || ''
    });
    setDialog('flag');
  };

  const handleSubmitFlag = (e) => {
    e.preventDefault();
    if (!activeTask) return;
    if (
      flagType === 'Cannot Complete' &&
      (!flagForm.scheduledWork.trim() || !flagForm.scheduledDate || !flagForm.scheduledTime)
    ) {
      return;
    }

    const flaggedBy = `${currentUser?.name || 'Mark Villanueva'} (${
      currentUser?.roleTitle || 'Lead Specialist'
    })`;

    if (flagType === 'Replacement') {
      raiseReplacementFlag(activeTask.id, {
        reason: flagForm.reason,
        itemSpecs: flagForm.itemSpecs,
        flaggedBy
      });
    } else {
      raiseMaintenanceFlag(activeTask.id, {
        type: flagType,
        reason: flagForm.reason,
        scheduledWork: flagForm.scheduledWork,
        scheduledDate: flagForm.scheduledDate,
        scheduledTime: flagForm.scheduledTime,
        flaggedBy
      });
    }

    setActionMessage(`${activeTask.controlNo || activeTask.id} outcome flag submitted to the Director.`);
    setDialog(null);
  };

  const handleViewTicket = (task) => {
    setActiveTask(task);
    setDialog('detail');
  };

  /* ---- Export whatever the technician is currently looking at ---- */
  const handleExportCSV = () => {
    if (!visibleTasks.length) return;
    const headers = [
      'Tracking No',
      'Title',
      'Location',
      'Category',
      'Urgency',
      'Status',
      'Date',
      'Requester',
      'Assigned To',
      'Field Notes'
    ];
    const quote = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = visibleTasks.map((t) =>
      [
        t.controlNo || t.id,
        t.title,
        t.location,
        t.category,
        t.urgency,
        t.status,
        t.date,
        t.requestedBy,
        t.assignedTo,
        t.notes || ''
      ]
        .map(quote)
        .join(',')
    );

    const csv = 'data:text/csv;charset=utf-8,' + [headers.map(quote).join(','), ...rows].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = `ISATU_WorkQueue_${activeView.label.replace(/\s+/g, '')}_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* ---- Render ---- */
  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '16px', fontFamily: "'Inter', Verdana, Geneva, Tahoma, sans-serif" }}>
      <PageHeader
        breadcrumbs={['Field Operations', 'Work Queue']}
        title="Maintenance Work Queue"
        description="ISAT U Dumangas Campus — Technical Operations & Work Dispatch"
        action={
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#047857',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: '700'
            }}
          >
            ● On Duty
          </span>
        }
      />

      {actionMessage && (
        <div className="queue-banner" role="status">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} aria-hidden="true" />
            {actionMessage}
          </span>
          <button type="button" className="queue-banner__dismiss" onClick={() => setActionMessage('')}>
            Dismiss
          </button>
        </div>
      )}

      {/* Saved views: horizontal cards that switch the queue and act as KPIs */}
      <QueueViewCards activeView={viewId} counts={viewCounts} onViewChange={handleViewChange} />

      {/* Safety protocol — only relevant while working the urgent queue */}
      {viewId === 'urgent' && viewTaskCount > 0 && (
        <div className="queue-safety">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
            <ShieldAlert size={22} color="#e11d48" style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
            <div>
              <div className="queue-safety__title">
                Immediate safety response required — {viewTaskCount} urgent or high-risk work order
                {viewTaskCount === 1 ? '' : 's'}
              </div>
              <div className="queue-safety__body">
                {activeView.title} · these carry a 2-hour response target. Attend in priority order.
              </div>
            </div>
          </div>
          <div className="queue-safety__steps">
            {[
              'Isolate breaker or valve',
              'Cordon off the work area',
              'Notify the Director on status'
            ].map((step, i) => (
              <div className="queue-safety__step" key={step}>
                <CheckSquare size={14} aria-hidden="true" /> {i + 1}. {step}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Statistics — a technician's view: what to attend first, where each
          work order sits, and which trade the work belongs to. */}
      <ChartsRow
        isEmpty={myQueue.length === 0}
        emptyTitle="Work order statistics"
        emptyCopy="No work orders in your queue yet."
      >
        <DonutCard title="Work Order Priority" icon="priority" list={myQueue} pick={(r) => r.urgency} palette="urgency" unit="WORK ORDERS" />
        <DonutCard title="Work Order Status" icon="status" list={myQueue} pick={(r) => r.status} palette="status" unit="WORK ORDERS" />
        <BarCard title="Work Orders by Category" icon="category" list={myQueue} pick={(r) => r.category} colorPick={(r) => r.status} colorPalette="status" totalLabel="work orders" />
      </ChartsRow>

      {/* The queue itself: one toolbar, one card list, every view */}
      <section
        className="content-card queue-card"
        id="work-queue-panel"
        role="tabpanel"
        aria-labelledby={`queue-tab-${activeView.id}`}
        aria-label={activeView.title}
      >
        <div className="queue-card__head">
          <div style={{ minWidth: 0 }}>
            <h2 className="queue-card__title">
              {activeView.title} ({viewTaskCount})
            </h2>
          </div>
        </div>

        <WorkQueueToolbar
          search={searchTerm}
          onSearchChange={handleSearchChange}
          category={categoryFilter}
          onCategoryChange={setCategoryFilter}
          urgency={urgencyFilter}
          onUrgencyChange={setUrgencyFilter}
          status={statusFilter}
          onStatusChange={setStatusFilter}
          assignee={assigneeFilter}
          onAssigneeChange={setAssigneeFilter}
          assignees={assignees}
          sort={sortOrder}
          onSortChange={setSortOrder}
          onReset={handleResetFilters}
          visibleCount={visibleTasks.length}
          totalCount={viewTaskCount}
          onExport={handleExportCSV}
          exportLabel={viewId === 'completed' ? 'Export Logs (CSV)' : 'Export (CSV)'}
        />

        <div className="queue-list">
          {visibleTasks.length === 0 ? (
            <div className="queue-empty">
              <Wrench size={32} style={{ margin: '0 auto', opacity: 0.4 }} aria-hidden="true" />
              <div className="queue-empty__title">
                {viewTaskCount === 0
                  ? `Nothing in the ${activeView.label} queue right now`
                  : `No ${activeView.label.toLowerCase()} work orders match these filters`}
              </div>
              <div className="queue-empty__hint">
                {viewTaskCount === 0
                  ? 'Try another queue view above, or check back after the next dispatch.'
                  : 'Adjust the search, category, urgency, status, or staff filter to widen the results.'}
              </div>
            </div>
          ) : (
            visibleTasks.map((task) => (
              <WorkOrderCard
                key={task.id}
                task={task}
                evaluationScore={evaluationScoreByKey.get(task.id) || evaluationScoreByKey.get(task.controlNo)}
                onStartWork={handleQuickStartWork}
                onUpdateStatus={handleOpenStatusDialog}
                onFlagOutcome={handleOpenFlagDialog}
                onViewTicket={handleViewTicket}
              />
            ))
          )}
        </div>
      </section>

      <WorkOrderDialogs
        task={activeTask}
        dialog={dialog}
        onClose={closeDialog}
        targetStatus={targetStatus}
        onTargetStatusChange={setTargetStatus}
        technicianNotes={technicianNotes}
        onTechnicianNotesChange={setTechnicianNotes}
        materialsUsed={materialsUsed}
        onMaterialsUsedChange={setMaterialsUsed}
        hoursSpent={hoursSpent}
        onHoursSpentChange={setHoursSpent}
        completionPhoto={completionPhoto}
        onCompletionPhotoChange={setCompletionPhoto}
        onSaveStatus={handleSaveTaskStatus}
        flagType={flagType}
        onFlagTypeChange={setFlagType}
        flagForm={flagForm}
        onFlagFormChange={setFlagForm}
        onSubmitFlag={handleSubmitFlag}
      />
    </div>
    </PageTransition>
  );
};

export default WorkQueue;
