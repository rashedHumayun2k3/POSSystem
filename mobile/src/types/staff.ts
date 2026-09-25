export type StaffRole="OWNER"|"MANAGER"|"STAFF"|"WAREHOUSE";
export type StaffUser={id:string;name:string;phone:string;role:StaffRole;monthlySalary:number;isActive:boolean};
export type StaffForm={name:string;phone:string;password:string;role:StaffRole;monthlySalary:string};
