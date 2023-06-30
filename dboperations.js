require('dotenv').config();
var config = require('./dbconfig');
const sql = require('mssql');
const dateFns = require('date-fns');

async function genNewSchedId() {
    let pool = await sql.connect(config);
    const result = await pool.request().query("SELECT TOP (1) id FROM cbs_sched ORDER BY id DESC");


    if (result.recordset.length !== 0) {
        let tempYear = dateFns.format(dateFns.addYears(new Date(), 543), 'yy');
        let tempMonth = dateFns.format(dateFns.addYears(new Date(), 543), 'MM');
        console.log("latest sched id = " + result.recordset[0].id);
        let tempIdSplit = result.recordset[0].id.split("-");
        console.log("year = " + tempIdSplit[0]);
        console.log("month = " + tempIdSplit[1]);
        let nextNum = parseInt(tempIdSplit[2]) + 1
        console.log("next num = " + nextNum);

        if (tempIdSplit[0] !== tempYear || tempIdSplit[1] !== tempMonth) {
            return dateFns.format(dateFns.addYears(new Date(), 543), 'yy-MM-001');
        }

        return (tempYear + "-" + tempMonth + "-" + String(nextNum).padStart(3, '0'));
    }
    else {
        return dateFns.format(dateFns.addYears(new Date(), 543), 'yy-MM-001');
    }

}

async function getAllPSNData() {

    console.log("let getAllPSNData");
    const result = await fetch(`http://${process.env.backendHost}:${process.env.himsPort}/api/hims/getallpsndata`)
        .then((response) => response.json())
        .then((data) => {
            console.log("getAllPSNData complete");
            return data;
        })
        .catch((error) => {
            if (error.name === "AbortError") {
                console.log("cancelled");
            }
            else {
                console.error('Error:', error);
            }
        });
    return result;

}

async function carBook(bookData) {
    try {
        console.log("carBook call by " + bookData.req_pid + " try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");

        console.log("generate new sched id");
        const schedId = await genNewSchedId();
        console.log("new sched id = " + schedId);

        console.log(bookData);
        console.log(bookData.drv_pid !== 0 ? bookData.drv_pid : "0");

        await pool.request()
            .input("id", sql.VarChar, schedId)
            .input("from_date", sql.SmallDateTime, bookData.from_date)
            .input("to_date", sql.SmallDateTime, bookData.to_date)
            .input("place", sql.VarChar, bookData.place)
            .input("province", sql.VarChar, bookData.province.label)
            .input("pax_amt", sql.TinyInt, bookData.pax_amt ?? 0)
            .input("tel_no", sql.VarChar, bookData.tel_no ?? "")
            .input("detail", sql.Text, bookData.detail)
            .input("req_pid", sql.VarChar, bookData.req_pid)
            .input("drv_pid", sql.VarChar, bookData.drv_pid !== 0 ? bookData.drv_pid : "0")
            .input("car_type_id", sql.TinyInt, bookData.car_type_id ?? 0)
            .input("car_id", sql.TinyInt, bookData.car_id ?? 0)
            .input("dept_id", sql.VarChar, bookData.dept_id)
            .query("INSERT INTO cbs_sched" +
                " (id, from_date, to_date, place, province, pax_amt, tel_no, detail, req_pid, drv_pid, car_type_id, dept_id, req_date, car_id, status_id)" +
                " VALUES (@id, @from_date, @to_date, @place, @province, @pax_amt, @tel_no, @detail, @req_pid, @drv_pid, @car_type_id, @dept_id, GETDATE(), @car_id, 1)");

        console.log("carBook complete");
        console.log("====================");
        return { "status": "ok" };
    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

async function reqPermit(bookData) {
    try {
        console.log("reqPermit call by " + bookData.rcv_pid + " try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");

        await pool.request()
            .input("id", sql.VarChar, bookData.id)
            .input("from_date", sql.SmallDateTime, bookData.from_date)
            .input("to_date", sql.SmallDateTime, bookData.to_date)
            .input("place", sql.VarChar, bookData.place)
            .input("province", sql.VarChar, bookData.province)
            .input("pax_amt", sql.TinyInt, bookData.pax_amt ? bookData.pax_amt : 0)
            .input("tel_no", sql.VarChar, bookData.tel_no ? bookData.tel_no : "")
            .input("detail", sql.Text, bookData.detail)
            .input("rcv_pid", sql.VarChar, bookData.rcv_pid)
            .input("drv_pid", sql.VarChar, bookData.drv_pid)
            .input("car_type_id", sql.TinyInt, bookData.car_type_id)
            .input("car_id", sql.TinyInt, bookData.car_id)
            .input("dept_id", sql.VarChar, bookData.dept_id)
            .query("UPDATE cbs_sched" +
                " SET from_date = @from_date" +
                ", to_date = @to_date" +
                ", place = @place" +
                ", province = @province" +
                ", pax_amt = @pax_amt" +
                ", tel_no = @tel_no" +
                ", detail = @detail" +
                ", rcv_pid = @rcv_pid" +
                ", drv_pid = @drv_pid" +
                ", car_type_id = @car_type_id" +
                ", car_id = @car_id" +
                ", dept_id = @dept_id" +
                ", rcv_date = GETDATE()" +
                ", status_id = 2" +
                " WHERE id = @id");

        console.log("reqPermit complete");
        console.log("====================");
        return { "status": "ok" };
    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

async function permitBook(bookData) {
    try {
        console.log("permitBook call by " + bookData.permit_pid + " try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");

        await pool.request()
            .input("id", sql.VarChar, bookData.id)
            .input("from_date", sql.SmallDateTime, bookData.from_date)
            .input("to_date", sql.SmallDateTime, bookData.to_date)
            .input("place", sql.VarChar, bookData.place)
            .input("province", sql.VarChar, bookData.province)
            .input("pax_amt", sql.TinyInt, bookData.pax_amt ? bookData.pax_amt : 0)
            .input("tel_no", sql.VarChar, bookData.tel_no ? bookData.tel_no : "")
            .input("detail", sql.Text, bookData.detail)
            .input("permit_pid", sql.VarChar, bookData.permit_pid)
            .input("drv_pid", sql.VarChar, bookData.drv_pid)
            .input("car_type_id", sql.TinyInt, bookData.car_type_id)
            .input("car_id", sql.TinyInt, bookData.car_id)
            .input("dept_id", sql.VarChar, bookData.dept_id)
            .query("UPDATE cbs_sched" +
                " SET from_date = @from_date" +
                ", to_date = @to_date" +
                ", place = @place" +
                ", province = @province" +
                ", pax_amt = @pax_amt" +
                ", tel_no = @tel_no" +
                ", detail = @detail" +
                ", permit_pid = @permit_pid" +
                ", drv_pid = @drv_pid" +
                ", car_type_id = @car_type_id" +
                ", car_id = @car_id" +
                ", dept_id = @dept_id" +
                ", permit_date = GETDATE()" +
                ", status_id = 3" +
                " WHERE id = @id");

        console.log("permitBook complete");
        console.log("====================");
        return { "status": "ok" };
    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

async function denyBook(bookData) {
    try {
        console.log("denyBook call by " + bookData.permit_pid + " try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");

        await pool.request()
            .input("id", sql.VarChar, bookData.id)
            .input("permit_pid", sql.VarChar, bookData.permit_pid)
            .input("note", sql.Text, bookData.note)
            .query("UPDATE cbs_sched" +
                " SET permit_pid = @permit_pid" +
                ", permit_date = GETDATE()" +
                ", note = @note" +
                ", status_id = 0" +
                " WHERE id = @id");

        console.log("denyBook complete");
        console.log("====================");
        return { "status": "ok" };
    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

async function useRecBook(bookData) {
    try {
        console.log("useRecBook call by " + bookData.rec_pid + " try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");

        let qryText = "UPDATE cbs_sched" +
            " SET rec_pid = @rec_pid" +
            ", dep_date = @dep_date" +
            ", dep_mi = @dep_mi" +
            ", arr_date = @arr_date" +
            ", arr_mi = @arr_mi" +
            ", rec_date = GETDATE()";

        if (bookData.dep_mi && bookData.arr_mi) {
            qryText += ", status_id = 4"
        }

        await pool.request()
            .input("id", sql.VarChar, bookData.id)
            .input("rec_pid", sql.VarChar, bookData.rec_pid)
            .input("dep_date", sql.SmallDateTime, bookData.dep_date)
            .input("dep_mi", sql.Int, bookData.dep_mi)
            .input("arr_date", sql.SmallDateTime, bookData.arr_date)
            .input("arr_mi", sql.Int, bookData.arr_mi)
            .query(qryText + " WHERE id = @id");

        console.log("useRecBook complete");
        console.log("====================");
        return { "status": "ok" };
    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

async function getCarType() {
    try {
        console.log("getCarType call try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");

        const result = await pool.request().query("SELECT * FROM cbs_car_type");

        console.log("getCarType complete");
        console.log("====================");
        return result.recordsets[0];
    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

async function getAllDept() {

    console.log("let getAllDept");
    const result = await fetch(`http://${process.env.backendHost}:${process.env.himsPort}/api/hims/getalldept`)
        .then((response) => response.json())
        .then((data) => {
            console.log("getAllDept complete");
            return data;
        })
        .catch((error) => {
            if (error.name === "AbortError") {
                console.log("cancelled");
            }
            else {
                console.error('Error:', error);
            }
        });
    return result;

}

async function getFilteredCar(fromDate, toDate, schedId) {
    try {
        console.log("getFilteredCar call try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");

        const busyCarQuery = await pool.request()
            .input("from_date", sql.SmallDateTime, fromDate)
            .input("to_date", sql.SmallDateTime, toDate)
            .query("SELECT id, car_id, dept_id FROM cbs_sched WHERE ((@from_date BETWEEN from_date AND to_date)" +
                " OR" +
                " (@to_date BETWEEN from_date AND to_date)" +
                " OR" +
                " (@from_date <= from_date AND @to_date >= to_date))" +
                " AND car_id IS NOT NULL AND status_id <> 0");
        const busyCar = busyCarQuery.recordsets[0];
        const car = await pool.request().query("SELECT cbs_car.id, cbs_car.type_id, cbs_car.reg_no, cbs_car.name FROM cbs_car");
        let filteredCar = car.recordsets[0];
        const deptQry = await getAllDept();

        for (let i = 0; i < busyCar.length; i += 1) {
            for (let n = 0; n < filteredCar.length; n += 1) {
                if (busyCar[i].car_id === filteredCar[n].id && busyCar[i].id !== schedId) {
                    if (filteredCar[n].duplicate) {
                        await Object.assign(filteredCar[n], {
                            "duplicate": filteredCar[n].duplicate + ", " + busyCar[i].id,
                            "dept_name": filteredCar[n].dept_name + ", " + deptQry.find(o => o.dept_id === busyCar[i].dept_id).dept_name,
                        });
                    }
                    else {
                        await Object.assign(filteredCar[n], {
                            "duplicate": busyCar[i].id,
                            "dept_name": deptQry.find(o => o.dept_id === busyCar[i].dept_id).dept_name,
                        });
                    }
                }

            }
        }

        console.log("getFilteredCar complete");
        console.log("====================");
        return filteredCar;
    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

async function getCar() {
    try {
        console.log("getCar call try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");
        const result = await pool.request().query("SELECT cbs_car.id, cbs_car.type_id, cbs_car.reg_no, cbs_car.name FROM cbs_car");
        console.log("getCar complete");
        console.log("====================");
        return result.recordsets[0];
    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

async function getDriver() {
    try {
        console.log("getDriver call try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");
        console.log("get driver pid from hostDB");
        const temp = await pool.request().query("SELECT personnel_level_list.personnel_id FROM personnel_level_list WHERE level_id = 'CBS_DRV'");
        const drvList = temp.recordsets[0];

        const psnList = await getAllPSNData();

        let result = [];
        result.push({
            id: 0,
            name: "ไม่ระบุ",
        });
        for (let i = 0; i < drvList.length; i += 1) {
            const prename = psnList.find(o => o.psn_id === drvList[i].personnel_id).pname;
            const name = psnList.find(o => o.psn_id === drvList[i].personnel_id).fname;
            const surname = psnList.find(o => o.psn_id === drvList[i].personnel_id).lname;
            result.push({
                id: drvList[i].personnel_id,
                name: prename + "" + name + " " + surname,
            });
        }

        return result;
    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

async function addPSNName(result) {
    console.log("get personnel data from hims");
    const psnList = await getAllPSNData();

    console.log("push personnel name into data");
    for (let i = 0; i < psnList.length; i += 1) {
        for (let n = 0; n < result.length; n += 1) {
            if (result[n].drv_pid === "0") {
                await Object.assign(result[n], { "drv_name": "ไม่ระบุ" });
            }
            if (psnList[i].psn_id === result[n].req_pid) {
                await Object.assign(result[n], { "req_name": psnList[i].pname + "" + psnList[i].fname + " " + psnList[i].lname });
            }
            if (psnList[i].psn_id === result[n].drv_pid) {
                await Object.assign(result[n], { "drv_name": psnList[i].pname + "" + psnList[i].fname + " " + psnList[i].lname });
            }
            if (psnList[i].psn_id === result[n].rcv_pid) {
                await Object.assign(result[n], { "rcv_name": psnList[i].pname + "" + psnList[i].fname + " " + psnList[i].lname });
            }
            if (psnList[i].psn_id === result[n].permit_pid) {
                await Object.assign(result[n], { "permit_name": psnList[i].pname + "" + psnList[i].fname + " " + psnList[i].lname });
            }
        }
    }
    return result
}

async function addDeptName(result) {
    console.log("get department data from hims");
    const deptList = await getAllDept();

    console.log("push department name into data");
    for (let i = 0; i < deptList.length; i += 1) {
        for (let n = 0; n < result.length; n += 1) {
            if (deptList[i].dept_id === result[n].dept_id) {
                await Object.assign(result[n], { "dept_name": deptList[i].dept_name });
            }
        }
    }
    return result;
}

const schedQueryText = "SELECT cbs_sched.*" +
    ", cbs_car_type.name AS car_type_name" +
    ", cbs_car.name AS car_name" +
    ", cbs_car.reg_no AS car_reg_no" +
    ", cbs_sched_status.name AS status_name" +
    " FROM cbs_sched" +
    " LEFT JOIN cbs_car_type ON cbs_car_type.id = cbs_sched.car_type_id" +
    " LEFT JOIN cbs_car ON cbs_car.id = cbs_sched.car_id" +
    " LEFT JOIN cbs_sched_status ON cbs_sched_status.id = cbs_sched.status_id ";

async function getAllSched() {
    try {
        console.log("getAllSched call try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");
        const schedData = await pool.request().query(schedQueryText + "ORDER BY cbs_sched.id DESC");
        let result = await addPSNName(schedData.recordsets[0]);
        result = await addDeptName(result);
        console.log("getAllSched complete");
        console.log("====================");
        return result;

    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

async function getAllSchedToday() {
    try {
        console.log("getAllSchedToday call try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");
        const schedData = await pool.request().query(schedQueryText + "WHERE (DATEDIFF(d, from_date, GETDATE()) = 0) ORDER BY cbs_sched.id DESC");
        let result = await addPSNName(schedData.recordsets[0]);
        result = await addDeptName(result);
        console.log("getAllSchedToday complete");
        console.log("====================");
        return result;

    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

async function getSchedByReqId(req_pid) {
    try {
        console.log("getSchedByReqId call by " + req_pid + " try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");
        const schedData = await pool.request().input("req_pid", sql.VarChar, req_pid).query(schedQueryText + "WHERE req_pid = @req_pid ORDER BY cbs_sched.id DESC");
        let result = await addPSNName(schedData.recordsets[0]);
        result = await addDeptName(result);
        console.log("getSchedByReqId complete");
        console.log("====================");
        return result;

    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

async function getSchedByDeptId(view_id, dept_id){
    try{

        console.log("getSchedByDeptId try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");

        // temporary use wait to migrate to hims database
        const himsPsnDept = await fetch(`http://${process.env.backendHost}:${process.env.himsPort}/api/hims/getpsndatabyid/${dept_id}`)
        .then((response) => response.json())
        .then((data) => {
            return data.dept_id;
        })
        .catch((error) => {
            if (error.name === "AbortError") {
                console.log("cancelled");
            }
            else {
                console.error('Error:', error);
            }
        });
        let limitChk = himsPsnDept;
        // end of temporary code

        // let limitChk = dept_id;
        if(view_id === "MGR"){
            limitChk = limitChk.slice(0, 3);
        }
        else if(view_id === "HMGR"){
            limitChk = limitChk.slice(0, 1);
        }
        else if(view_id === "ALL"){
            limitChk = "";
        }

        const schedData = await pool.request().query(schedQueryText + " WHERE cbs_sched.dept_id LIKE '"+limitChk+"%' ORDER BY cbs_sched.id DESC");
        let result = await addPSNName(schedData.recordsets[0]);
        result = await addDeptName(result);

        console.log("getSchedByDeptId complete");
        console.log("====================");
        return result;

    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

async function getPermitReqSched() {
    try {
        console.log("getPermitReqSched call try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");
        const schedData = await pool.request().query(schedQueryText + "WHERE cbs_sched.status_id = 1 ORDER BY cbs_sched.id DESC");
        let result = await addPSNName(schedData.recordsets[0]);
        result = await addDeptName(result);
        console.log("getPermitReqSched complete");
        console.log("====================");
        return result;

    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

async function getPermitSched() {
    try {
        console.log("getPermitSched call try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");
        const schedData = await pool.request().query(schedQueryText + "WHERE cbs_sched.status_id = 2 ORDER BY cbs_sched.id DESC");
        let result = await addPSNName(schedData.recordsets[0]);
        result = await addDeptName(result);
        console.log("getPermitSched complete");
        console.log("====================");
        return result;

    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

async function getDrvSched() {
    try {
        console.log("getDrvSched call try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");
        const schedData = await pool.request().query(schedQueryText + "WHERE cbs_sched.status_id = 3" +
            " AND ( dep_date IS NULL OR dep_mi IS NULL OR arr_date IS NULL OR arr_mi IS NULL )" +
            " ORDER BY cbs_sched.id DESC");
        let result = await addPSNName(schedData.recordsets[0]);
        result = await addDeptName(result);
        console.log("getDrvSched complete");
        console.log("====================");
        return result;
    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

async function getStatCntr() {
    try {
        console.log("getStatCntr call try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");
        const taskCntr = await pool.request().query(
            "SELECT COUNT(CASE WHEN status_id = 1 then 1 END) AS 'request'" +
            ", COUNT(CASE WHEN status_id = 2 then 1 END) AS 'permitRep'" +
            ", COUNT(CASE WHEN status_id = 3 then 1 END) AS 'permit'" +
            " FROM cbs_sched" +
            " WHERE to_date > GETDATE()"
        );
        let result = taskCntr.recordset[0];
        const carCntr = await pool.request().query(
            "SELECT COUNT(id) AS 'car_amt'" +
            " FROM cbs_car"
        );
        await Object.assign(result, { "car_amt": carCntr.recordset[0].car_amt });
        console.log("getStatCntr complete");
        console.log("====================");
        return result;
    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

module.exports = {
    carBook: carBook,
    reqPermit: reqPermit,
    denyBook: denyBook,
    permitBook: permitBook,
    useRecBook: useRecBook,
    getCarType: getCarType,
    getFilteredCar: getFilteredCar,
    getCar: getCar,
    getDriver: getDriver,
    getAllSched: getAllSched,
    getAllSchedToday: getAllSchedToday,
    getSchedByReqId: getSchedByReqId,
    getSchedByDeptId: getSchedByDeptId,
    getPermitReqSched: getPermitReqSched,
    getPermitSched: getPermitSched,
    getDrvSched: getDrvSched,
    getStatCntr: getStatCntr,
}