import prisma from '../utils/database.js';

interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  hireDate: Date;
  doublesEndorsement: boolean;
  chainExperience: boolean;
  isEligible: boolean;
}

interface Route {
  id: string;
  runNumber: string;
  requiresDoublesEndorsement: boolean;
  requiresChainExperience: boolean;
}

interface Selection {
  id: string;
  employeeId: string;
  firstChoiceId?: string | null;
  secondChoiceId?: string | null;
  thirdChoiceId?: string | null;
  employee: Employee;
}

interface AssignmentResult {
  employeeId: string;
  routeId?: string | null;
  choiceReceived?: number | null;
  reason?: string;
}

export class AssignmentEngine {
  private selections: Selection[] = [];
  private routes: Map<string, Route> = new Map();
  private assignedRoutes: Set<string> = new Set();
  private assignments: AssignmentResult[] = [];

  async processAssignments(selectionPeriodId: string): Promise<AssignmentResult[]> {
    try {
      await this.loadData(selectionPeriodId);
      await this.runAssignmentAlgorithm();
      return this.assignments;
    } catch (error) {
      console.error('Assignment processing error:', error);
      throw error;
    }
  }

  private async loadData(selectionPeriodId: string): Promise<void> {
    // Get the selection period to find the terminal
    const selectionPeriod = await prisma.selectionPeriod.findUnique({
      where: { id: selectionPeriodId },
    });

    if (!selectionPeriod) {
      throw new Error('Selection period not found');
    }

    // Load all selections for the period
    this.selections = await prisma.selection.findMany({
      where: { selectionPeriodId },
      include: {
        employee: true,
      },
    });

    // Load routes associated with the selection period
    const periodRoutes = await prisma.periodRoute.findMany({
      where: { selectionPeriodId },
      include: {
        route: true,
      },
    });

    const routes = periodRoutes.map(pr => pr.route);

    this.routes.clear();
    routes.forEach(route => {
      this.routes.set(route.id, route);
    });

    // Load employees without selections (they go to float pool)
    const employeesWithSelections = this.selections.map(s => s.employeeId);
    const employeesWithoutSelections = await prisma.employee.findMany({
      where: {
        isEligible: true,
        terminalId: selectionPeriod.terminalId,
        id: { notIn: employeesWithSelections },
      },
    });

    // Add employees without selections to the list (they'll get null assignments)
    employeesWithoutSelections.forEach(employee => {
      this.selections.push({
        id: `no-selection-${employee.id}`,
        employeeId: employee.id,
        firstChoiceId: null,
        secondChoiceId: null,
        thirdChoiceId: null,
        employee,
      });
    });

    this.assignedRoutes.clear();
    this.assignments = [];
  }

  private async runAssignmentAlgorithm(): Promise<void> {
    // Sort employees by seniority (hire date ascending, then last name ascending)
    const sortedSelections = [...this.selections].sort((a, b) => {
      const hireDateCompare = a.employee.hireDate.getTime() - b.employee.hireDate.getTime();
      if (hireDateCompare !== 0) {
        return hireDateCompare;
      }
      return a.employee.lastName.localeCompare(b.employee.lastName);
    });

    // Process each employee in seniority order
    for (const selection of sortedSelections) {
      await this.processEmployeeSelection(selection);
    }
  }

  private async processEmployeeSelection(selection: Selection): Promise<void> {
    const employee = selection.employee;

    // If employee has no selections, assign to float pool
    if (!selection.firstChoiceId && !selection.secondChoiceId && !selection.thirdChoiceId) {
      this.assignments.push({
        employeeId: employee.id,
        routeId: null,
        choiceReceived: null,
        reason: 'No route preferences submitted - assigned to float pool',
      });
      return;
    }

    // Try to assign employee's choices in order
    const choices = [
      { id: selection.firstChoiceId, choice: 1 },
      { id: selection.secondChoiceId, choice: 2 },
      { id: selection.thirdChoiceId, choice: 3 },
    ].filter(choice => choice.id);

    for (const { id: routeId, choice } of choices) {
      if (!routeId) continue;

      const route = this.routes.get(routeId);
      if (!route) {
        console.warn(`Route ${routeId} not found for employee ${employee.employeeId}`);
        continue;
      }

      // Check if route is already assigned
      if (this.assignedRoutes.has(routeId)) {
        continue;
      }

      // Check if employee qualifies for this route
      if (!this.doesEmployeeQualify(employee, route)) {
        continue;
      }

      // Assign the route
      this.assignedRoutes.add(routeId);
      this.assignments.push({
        employeeId: employee.id,
        routeId,
        choiceReceived: choice,
        reason: `Assigned ${choice === 1 ? '1st' : choice === 2 ? '2nd' : '3rd'} choice route`,
      });
      return;
    }

    // If no choices could be assigned, check for unqualified vs unavailable
    let hasQualifiedChoices = false;
    for (const { id: routeId } of choices) {
      if (!routeId) continue;

      const route = this.routes.get(routeId);
      if (route && this.doesEmployeeQualify(employee, route)) {
        hasQualifiedChoices = true;
        break;
      }
    }

    // Assign to float pool with appropriate reason
    this.assignments.push({
      employeeId: employee.id,
      routeId: null,
      choiceReceived: null,
      reason: hasQualifiedChoices 
        ? 'All preferred routes were assigned to more senior employees'
        : 'Employee does not qualify for any of their preferred routes',
    });
  }

  private doesEmployeeQualify(employee: Employee, route: Route): boolean {
    // Check doubles endorsement requirement
    if (route.requiresDoublesEndorsement && !employee.doublesEndorsement) {
      return false;
    }

    // Check chain experience requirement
    if (route.requiresChainExperience && !employee.chainExperience) {
      return false;
    }

    return true;
  }

  async saveAssignments(selectionPeriodId: string): Promise<void> {
    // Save all assignments in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete existing assignments for this period
      await tx.assignment.deleteMany({
        where: { selectionPeriodId },
      });

      // Create new assignments
      const assignmentData = this.assignments.map(assignment => ({
        employeeId: assignment.employeeId,
        selectionPeriodId,
        routeId: assignment.routeId,
        choiceReceived: assignment.choiceReceived,
        effectiveDate: new Date(), // You might want to make this configurable
      }));

      await tx.assignment.createMany({
        data: assignmentData,
      });

      // Update employee current routes
      for (const assignment of this.assignments) {
        if (assignment.routeId) {
          await tx.employee.update({
            where: { id: assignment.employeeId },
            data: { currentRouteId: assignment.routeId },
          });
        } else {
          // Clear current route for float pool assignments
          await tx.employee.update({
            where: { id: assignment.employeeId },
            data: { currentRouteId: null },
          });
        }
      }
    });
  }

  getAssignmentSummary(): {
    totalEmployees: number;
    totalRoutes: number;
    assignedRoutes: number;
    floatPoolEmployees: number;
    choiceDistribution: { first: number; second: number; third: number; float: number };
  } {
    const totalEmployees = this.assignments.length;
    const totalRoutes = this.routes.size;
    const assignedRoutes = this.assignedRoutes.size;
    const floatPoolEmployees = this.assignments.filter(a => !a.routeId).length;

    const choiceDistribution = {
      first: this.assignments.filter(a => a.choiceReceived === 1).length,
      second: this.assignments.filter(a => a.choiceReceived === 2).length,
      third: this.assignments.filter(a => a.choiceReceived === 3).length,
      float: floatPoolEmployees,
    };

    return {
      totalEmployees,
      totalRoutes,
      assignedRoutes,
      floatPoolEmployees,
      choiceDistribution,
    };
  }

  validateAssignments(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for duplicate route assignments
    const routeAssignments = new Map<string, string[]>();
    for (const assignment of this.assignments) {
      if (assignment.routeId) {
        if (!routeAssignments.has(assignment.routeId)) {
          routeAssignments.set(assignment.routeId, []);
        }
        routeAssignments.get(assignment.routeId)!.push(assignment.employeeId);
      }
    }

    for (const [routeId, employeeIds] of routeAssignments) {
      if (employeeIds.length > 1) {
        const route = this.routes.get(routeId);
        errors.push(`Route ${route?.runNumber || routeId} assigned to multiple employees: ${employeeIds.join(', ')}`);
      }
    }

    // Check that all eligible employees have assignments
    const assignedEmployeeIds = new Set(this.assignments.map(a => a.employeeId));
    const expectedEmployeeIds = new Set(this.selections.map(s => s.employeeId));

    for (const employeeId of expectedEmployeeIds) {
      if (!assignedEmployeeIds.has(employeeId)) {
        errors.push(`Employee ${employeeId} missing assignment`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}