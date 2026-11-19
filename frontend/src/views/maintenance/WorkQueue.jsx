import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Wrench, CheckSquare, ShieldAlert, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PageHeader } from '../../components/common/PageHeader';
import { PageTransition } from '../../components/common/PageTransition';
import { QueueViewCards } from '../../components/maintenance/QueueViewCards';
import { WorkQueueToolbar } from '../../components/maintenance/WorkQueueToolbar';
import { WorkOrderCard } from '../../components/maintenance/WorkOrderCard';
import { WorkOrderDialogs } from '../../components/maintenance/WorkOrderDialogs';
import { ChartsRow, DonutCard, BarCard } from '../../components/common/DashboardCharts';
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
export const WorkQueue = ({ activeTab = 'tech-tasks', onTabChange, initialView }) => {
  const { currentUser } = useAuth();
  const isHistoryView = activeTab === 'tech-history';

  const {
    requisitions,
    updateRequisitionStatus,
    updateRequisitionForm,
    fetchRequisitionDetail,
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
  const [viewId, setViewId] = useState(() => (isHistoryView ? 'completed' : initialView || LEGACY_TAB_VIEW[activeTab] || 'all'));

  useEffect(() => {
    if (isHistoryView) {
      setViewId('completed');
      return;
    }
    if (initialView) {
      setViewId(initialView);
      return;
    }
    const legacyView = LEGACY_TAB_VIEW[activeTab];
    if (legacyView) {
      setViewId(legacyView);
      if (activeTab === 'tech-emergency') {
        onTabChange?.('tech-tasks');
      }
    }
  }, [activeTab, initialView, isHistoryView, onTabChange]);

  // Deep link: a clicked notification stores its ticket ref here
  useEffect(() => {
    if (!focusedTicketRef) return;
    if (!requisitions || requisitions.length === 0) return;
    const refStr = String(focusedTicketRef || '').trim().toLowerCase();
    const found = (requisitions || []).find(r =>
      String(r.controlNo || '').toLowerCase() === refStr ||
      String(r.id || '').toLowerCase() === refStr ||
      String(r.ticket_no || '').toLowerCase() === refStr ||
      String(r.id_raw || '').toLowerCase() === refStr ||
      String(r.officialTrackingNo || '').toLowerCase() === refStr
    );
    if (found) {
      setActiveTask(found);
      setDialog('detail');
      setFocusedTicketRef(null);
    }
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
    if (nextView === 'completed') {
      setStatusFilter('completed');
      setSortOrder('newest'); // History tab defaults to most-recent-first
    } else if (nextView === 'in-progress') {
      setStatusFilter('ongoing');
    } else {
      if (statusFilter === 'completed' || statusFilter === 'ongoing') setStatusFilter('all');
    }
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


  /* ---- Actions ---- */
  const handleQuickStartWork = async (task) => {
    try {
      const logNote = `Technician ${technicianName} started on-site maintenance assessment at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
      await updateRequisitionStatus(task.id, 'Ongoing', technicianName, logNote);
      setActionMessage(`${task.controlNo || task.id} work started successfully.`);
    } catch (err) {
      console.error('Failed to start work:', err);
      setActionMessage(`Failed to start work: ${err.message || 'Unknown error'}`);
    }
  };

  const handleOpenStatusDialog = (task) => {
    setActiveTask(task);
    setTargetStatus(task.status === 'Pending' || task.status === 'Approved' ? 'Ongoing' : task.status);
    setTechnicianNotes(task.notes || '');
    setMaterialsUsed(task.materialsUsed || '');
    setCompletionPhoto(task.completionPhotoUrl || null);
    setDialog('status');
  };

  const handleSaveTaskStatus = async () => {
    if (!activeTask) return;
    // Completed records are locked — the service record must stay immutable.
    if (activeTask.status === 'Completed') {
      setActionMessage(`${activeTask.controlNo || activeTask.id} is already completed and cannot be changed.`);
      setDialog(null);
      return;
    }

    const finalNotes = technicianNotes || `Work performed on-site by ${technicianName}.`;

    try {
      await updateRequisitionStatus(
        activeTask.id,
        targetStatus,
        technicianName,
        finalNotes,
        materialsUsed,
        completionPhoto || undefined
      );
      if (completionPhoto) {
        await updateRequisitionForm(activeTask.id, { completionPhotoUrl: completionPhoto });
      }
      setActionMessage(`${activeTask.controlNo || activeTask.id} work log saved successfully.`);
      setDialog(null);
    } catch (err) {
      console.error('Failed to update task status:', err);
      setActionMessage(`Error saving status: ${err.message || 'Unknown error'}`);
    }
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

  const handleSubmitFlag = async (e) => {
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

    try {
      if (flagType === 'Replacement') {
        await raiseReplacementFlag(activeTask.id, {
          reason: flagForm.reason,
          itemSpecs: flagForm.itemSpecs,
          flaggedBy
        });
      } else {
        await raiseMaintenanceFlag(activeTask.id, {
          type: flagType,
          reason: flagForm.reason,
          scheduledWork: flagForm.scheduledWork,
          scheduledDate: flagForm.scheduledDate,
          scheduledTime: flagForm.scheduledTime,
          flaggedBy
        });
      }

      setActionMessage(`${activeTask.controlNo || activeTask.id} outcome flag submitted to the Director. You may now view or print the PDF Flag Report.`);
      setDialog(null);
    } catch (err) {
      console.error('Failed to submit flag:', err);
      setActionMessage(`Error submitting flag: ${err.message || 'Unknown error'}`);
    }
  };

  const handleViewTicket = async (task) => {
    setActiveTask(task);
    setDialog('detail');
    if (fetchRequisitionDetail) {
      const full = await fetchRequisitionDetail(task.id_raw ?? task.id);
      if (full) setActiveTask(prev => (prev && (prev.id === task.id || prev.id_raw === task.id_raw) ? { ...prev, ...full } : prev));
    }
  };

  const handlePrintFlagReport = async (task) => {
    setActiveTask(task);
    setDialog('flag-report');
    if (fetchRequisitionDetail) {
      const full = await fetchRequisitionDetail(task.id_raw ?? task.id);
      if (full) setActiveTask(prev => (prev && (prev.id === task.id || prev.id_raw === task.id_raw) ? { ...prev, ...full } : prev));
    }
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

    const csvContent = '\uFEFF' + [headers.map(quote).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ISATU_WorkQueue_${activeView.label.replace(/\s+/g, '')}_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /* ---- Render ---- */
  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: "'Inter', Verdana, Geneva, Tahoma, sans-serif" }}>
        <PageHeader
          style={{ marginBottom: '0' }}
          breadcrumbs={isHistoryView ? ['Field Operations', 'Request History'] : ['Field Operations', 'Work Queue']}
          title={isHistoryView ? 'Request History' : 'Maintenance Work Queue'}
          description={
            isHistoryView
              ? 'Comprehensive record of completed maintenance and facility work orders'
              : 'ISAT U Dumangas Campus — Technical Operations & Work Dispatch'
          }
        />

        {/* Workload statistics for this technician's queue */}
        {!isHistoryView && (
          <ChartsRow isEmpty={myQueue.length === 0}>
            <DonutCard
              title="Work Order Priority"
              icon="priority"
              list={myQueue}
              pick={(r) => r.urgency}
              palette="urgency"
              unit="ORDERS"
            />
            <DonutCard
              title="Work Order Status"
              icon="status"
              list={myQueue}
              pick={(r) => r.status}
              palette="status"
              unit="ORDERS"
            />
            <BarCard
              title="Work Orders by Category"
              icon="category"
              list={myQueue}
              pick={(r) => r.category}
              colorPick={(r) => r.status}
              colorPalette="status"
            />
          </ChartsRow>
        )}

        {/* Queue View Switcher Cards — shown on Work Queue only, omitted on Request History */}
        {!isHistoryView && (
          <QueueViewCards activeView={viewId} counts={viewCounts} onViewChange={handleViewChange} />
        )}

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

        {/* Safety protocol — only relevant while working the urgent queue */}
        {!isHistoryView && viewId === 'urgent' && viewTaskCount > 0 && (
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

        {/* The queue itself: one toolbar, one card list, every view */}
        <section
          className="content-card queue-card"
          id="work-queue-panel"
          role="tabpanel"
          aria-labelledby={`queue-tab-${activeView.id}`}
          aria-label={isHistoryView ? 'Request History' : activeView.title}
        >
          <div className="queue-card__head">
            <div style={{ minWidth: 0 }}>
              <h2 className="queue-card__title">
                {isHistoryView ? 'Completed Work Orders' : activeView.title} ({visibleTasks.length})
              </h2>
              {isHistoryView && (
                <p className="queue-card__subtitle">
                  Verified repair and maintenance logs filed across campus facilities
                </p>
              )}
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
            exportLabel={isHistoryView || viewId === 'completed' ? 'Export Logs (CSV)' : 'Export (CSV)'}
            hideStatusFilter={isHistoryView}
          />

          <div className="queue-list">
            {visibleTasks.length === 0 ? (
              <div className="queue-empty">
                <Wrench size={32} style={{ margin: '0 auto', opacity: 0.4 }} aria-hidden="true" />
                <div className="queue-empty__title">
                  {isHistoryView
                    ? 'No completed work history found'
                    : viewTaskCount === 0
                    ? `Nothing in the ${activeView.label} queue right now`
                    : `No ${activeView.label.toLowerCase()} work orders match these filters`}
                </div>
                <div className="queue-empty__hint">
                  {isHistoryView
                    ? 'Resolved and signed-off maintenance requests will automatically appear here.'
                    : viewTaskCount === 0
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
                onPrintFlagReport={handlePrintFlagReport}
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
