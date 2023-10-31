require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });
var config = require("./dbconfig");
const sql = require("mssql");
const dateFns = require("date-fns");

async function genNewSchedId() {
  let pool = await sql.connect(config);
  const result = await pool
    .request()
    .query("SELECT TOP (1) id FROM cbs_sched ORDER BY id DESC");

  if (result.recordset.length !== 0) {
    let tempYear = dateFns.format(dateFns.addYears(new Date(), 543), "yy");
    let tempMonth = dateFns.format(dateFns.addYears(new Date(), 543), "MM");
    console.log("latest sched id = " + result.recordset[0].id);
    let tempIdSplit = result.recordset[0].id.split("-");
    console.log("year = " + tempIdSplit[0]);
    console.log("month = " + tempIdSplit[1]);
    let nextNum = parseInt(tempIdSplit[2]) + 1;
    console.log("next num = " + nextNum);

    if (tempIdSplit[0] !== tempYear || tempIdSplit[1] !== tempMonth) {
      return dateFns.format(dateFns.addYears(new Date(), 543), "yy-MM-001");
    }

    return tempYear + "-" + tempMonth + "-" + String(nextNum).padStart(3, "0");
  } else {
    return dateFns.format(dateFns.addYears(new Date(), 543), "yy-MM-001");
  }
}

async function genNewSchedGrpId() {
  let pool = await sql.connect(config);
  const result = await pool
    .request()
    .query("SELECT TOP (1) id FROM cbs_sched_grp ORDER BY id DESC");

  if (result.recordset.length !== 0) {
    console.log("latest sched group id = " + result.recordset[0].id);
    let tempIdShift = result.recordset[0].id.slice(1);
    let nextNum = parseInt(tempIdShift) + 1;
    console.log("next num = " + nextNum);

    return "G" + String(nextNum).padStart(5, "0");
  } else {
    return "G00001";
  }
}

async function getAllPSNData() {
  console.log("let getAllPSNData");
  const result = await fetch(
    `http://${process.env.backendHost}:${process.env.himsPort}/api/himspsn/getallpsn`
  )
    .then((response) => response.json())
    .then((data) => {
      console.log("getAllPSNData complete");
      return data;
    })
    .catch((error) => {
      if (error.name === "AbortError") {
        console.log("cancelled");
      } else {
        console.error("Error:", error);
      }
    });
  return result;
}

async function sendLineNotify(sendMessage) {
  console.log("send line notify");
  fetch(process.env.lineNotify, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${process.env.CBS_lineToken}`,
    },
    body: new URLSearchParams(sendMessage),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log(data);
      console.log("send data to line complete");
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}

async function createDateToShow(fromDate, toDate) {
  let dateToShow = `${new Date(fromDate).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })} ${new Date(fromDate).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  })}น.`;

  if (
    new Date(fromDate).toUTCString().slice(0, -13) ===
    new Date(toDate).toUTCString().slice(0, -13)
  ) {
    dateToShow =
      dateToShow +
      ` - ${new Date(toDate).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      })}น.`;
  } else {
    dateToShow =
      dateToShow +
      ` - ${new Date(toDate).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      })} ${new Date(toDate).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      })}น.`;
  }

  return dateToShow;
}

async function carBook(bookData) {
  try {
    console.log(
      "carBook call by " + bookData.req_pid + " try connect to server"
    );
    let pool = await sql.connect(config);
    console.log("connect complete");

    console.log("generate new sched id");
    const schedId = await genNewSchedId();
    console.log("new sched id = " + schedId);

    // console.log(bookData);
    // console.log(bookData.drv_pid !== 0 ? bookData.drv_pid : "0");

    await pool
      .request()
      .input("id", sql.VarChar, schedId)
      .input("from_date", sql.SmallDateTime, bookData.from_date)
      .input("to_date", sql.SmallDateTime, bookData.to_date)
      .input("place", sql.VarChar, bookData.place)
      .input("province", sql.VarChar, bookData.province.label)
      .input("pax_amt", sql.TinyInt, bookData.pax_amt ?? 0)
      .input("tel_no", sql.VarChar, bookData.tel_no ?? "")
      .input("detail", sql.Text, bookData.detail)
      .input("req_pid", sql.VarChar, bookData.req_pid)
      .input(
        "drv_pid",
        sql.VarChar,
        bookData.drv_pid !== 0 ? bookData.drv_pid : "0"
      )
      .input("car_type_id", sql.TinyInt, bookData.car_type_id ?? 0)
      .input("car_id", sql.TinyInt, bookData.car_id ?? 0)
      .input("dept_id", sql.VarChar, bookData.dept_id)
      .input("note", sql.VarChar, bookData.note)
      .query(
        "INSERT INTO cbs_sched" +
          " (id, from_date, to_date, place, province, pax_amt, tel_no, detail, req_pid, drv_pid, car_type_id, dept_id, req_date, car_id, status_id, note)" +
          " VALUES (@id, @from_date, @to_date, @place, @province, @pax_amt, @tel_no, @detail, @req_pid, @drv_pid, @car_type_id, @dept_id, GETDATE(), @car_id, 1, @note)"
      );

    let dateToShow = await createDateToShow(
      bookData.from_date,
      bookData.to_date
    );

    sendLineNotify({
      message:
        "มีการขอใช้รถใหม่" +
        "\nเลขที่: " +
        schedId +
        "\nผู้ขอ: " +
        bookData.req_name +
        "\nแผนก: " +
        bookData.dept_name +
        "\nสถานที่: " +
        bookData.place +
        "\nเวลาเดินทาง: " +
        dateToShow +
        "\nรายละเอียด: " +
        bookData.detail,
    });

    console.log("carBook complete");
    console.log("====================");
    return { status: "ok" };
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function mergeBook(mergeBookData) {
  try {
    console.log(
      "mergeBook call by " + mergeBookData.req_pid + " try connect to server"
    );
    let pool = await sql.connect(config);
    console.log("connect complete");

    const schedGrpId = await genNewSchedGrpId();

    console.log("find from_date and to_date");
    let fromDate = "";
    let toDate = "";
    for (let i = 0; i < mergeBookData.id_list.length; i += 1) {
      if (fromDate === "" || mergeBookData.id_list[i].from_date < fromDate) {
        fromDate = mergeBookData.id_list[i].from_date;
      }
      if (toDate === "" || mergeBookData.id_list[i].to_date > toDate) {
        toDate = mergeBookData.id_list[i].to_date;
      }
    }

    console.log("add data into sched_grp");
    await pool
      .request()
      .input("id", sql.VarChar, schedGrpId)
      .input("from_date", sql.SmallDateTime, fromDate)
      .input("to_date", sql.SmallDateTime, toDate)
      .input("req_pid", sql.VarChar, mergeBookData.req_pid)
      .input("rcv_pid", sql.VarChar, mergeBookData.req_pid)
      .input("car_type_id", sql.TinyInt, mergeBookData.car_type_id)
      .input("car_id", sql.TinyInt, mergeBookData.car_id)
      .input("drv_pid", sql.VarChar, mergeBookData.drv_pid)
      .query(
        "INSERT INTO cbs_sched_grp" +
          " (id, status_id, from_date, to_date, car_type_id, car_id, drv_pid, req_pid, req_date, rcv_pid, rcv_date)" +
          " VALUES (@id, 2, @from_date, @to_date, @car_type_id, @car_id, @drv_pid, @req_pid, GETDATE(), @rcv_pid, GETDATE())"
      );

    console.log("add data into sched");
    let idList = "";
    for (let i = 0; i < mergeBookData.id_list.length; i++) {
      let dateToPush = await createDateToShow(
        mergeBookData.id_list[i].from_date,
        mergeBookData.id_list[i].to_date
      );
      idList +=
        "\n\nเลขที่: " +
        mergeBookData.id_list[i].id +
        "\nผู้ขอ: " +
        mergeBookData.id_list[i].req_name +
        "\nแผนก: " +
        mergeBookData.id_list[i].dept_name +
        "\nสถานที่: " +
        mergeBookData.id_list[i].place +
        "\nเวลาเดินทาง: " +
        dateToPush;
      await pool
        .request()
        .input("grp_id", sql.VarChar, schedGrpId)
        .input("id", sql.VarChar, mergeBookData.id_list[i].id)
        .input("car_type_id", sql.TinyInt, mergeBookData.car_type_id)
        .input("car_id", sql.TinyInt, mergeBookData.car_id)
        .input("drv_pid", sql.VarChar, mergeBookData.drv_pid)
        .input("rcv_pid", sql.VarChar, mergeBookData.req_pid)
        .query(
          "UPDATE cbs_sched" +
            " SET grp_id = @grp_id" +
            ", status_id = 2" +
            ", car_type_id = @car_type_id" +
            ", car_id = @car_id" +
            ", drv_pid = @drv_pid" +
            ", rcv_pid = @rcv_pid" +
            ", rcv_date = GETDATE()" +
            " WHERE id = @id"
        );
    }
    let dateToShow = await createDateToShow(fromDate, toDate);

    sendLineNotify({
      message:
        "มีการรวมคำขอใช้รถใหม่" +
        "\nกลุ่มงานเลขที่: " +
        schedGrpId +
        "\nผู้รวม: " +
        mergeBookData.req_name +
        "\nเวลาเดินทาง: " +
        dateToShow +
        "\nรายการคำขอใช้รถ: " +
        idList,
    });

    console.log("mergeBook complete");
    console.log("====================");
    return { status: "ok" };
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function mergeBookAdd(mergeBookData) {
  try {
    console.log("mergeBookAdd call, try connect to server");
    let pool = await sql.connect(config);
    console.log("connect complete");
    let idList = "";
    for (let i = 0; i < mergeBookData.id_list.length; i += 1) {
      idList += "\n" + mergeBookData.id_list[i].id + " ";
      console.log(
        "update group id = " +
          mergeBookData.sched_grp.id +
          " into schedule id = " +
          mergeBookData.id_list[i].id
      );
      await pool
        .request()
        .input("grp_id", sql.VarChar, mergeBookData.sched_grp.id)
        .input("id", sql.VarChar, mergeBookData.id_list[i].id)
        .input("car_type_id", sql.TinyInt, mergeBookData.sched_grp.car_type_id)
        .input("car_id", sql.TinyInt, mergeBookData.sched_grp.car_id)
        .input("drv_pid", sql.VarChar, mergeBookData.sched_grp.drv_pid)
        .input("rcv_pid", sql.VarChar, mergeBookData.rcv_pid)
        .query(
          "UPDATE cbs_sched" +
            " SET" +
            " grp_id = @grp_id" +
            ", car_type_id = @car_type_id" +
            ", car_id = @car_id" +
            ", drv_pid = @drv_pid" +
            ", rcv_pid = @rcv_pid" +
            ", rcv_date = GETDATE()" +
            " WHERE id = @id"
        );
    }

    console.log("update status and max/min date in group schedule");
    let fromDate = mergeBookData.sched_grp.from_date;
    let toDate = mergeBookData.sched_grp.to_date;
    for (let i = 0; i < mergeBookData.id_list.length; i += 1) {
      if (mergeBookData.id_list[i].from_date < fromDate) {
        fromDate = mergeBookData.id_list[i].from_date;
      }
      if (mergeBookData.id_list[i].to_date > toDate) {
        toDate = mergeBookData.id_list[i].to_date;
      }
    }
    await pool
      .request()
      .input("id", sql.VarChar, mergeBookData.sched_grp.id)
      .input("from_date", sql.SmallDateTime, fromDate)
      .input("to_date", sql.VarChar, toDate)
      .query(
        "UPDATE cbs_sched_grp SET status_id = 2, from_date = @from_date, to_date = @to_date WHERE id = @id"
      );

    console.log("update schedule");
    await pool
      .request()
      .input("grp_id", sql.VarChar, mergeBookData.sched_grp.id)
      .query("UPDATE cbs_sched SET status_id = 2 WHERE grp_id = @grp_id");

    let dateToShow = await createDateToShow(fromDate, toDate);

    sendLineNotify({
      message:
        "มีการเพิ่มคำขอใช้รถเข้ากลุ่มงาน" +
        "\nกลุ่มงานเลขที่: " +
        mergeBookData.sched_grp.id +
        "\nรายการเลขที่คำขอใช้รถที่เพิ่ม: " +
        idList +
        "\nผู้รวม: " +
        mergeBookData.req_name +
        "\nเวลาเดินทาง: " +
        dateToShow,
    });

    console.log("mergeBookAdd complete");
    console.log("====================");
    return { status: "ok" };
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function reqPermit(bookData) {
  try {
    console.log(
      "reqPermit call by " + bookData.rcv_pid + " try connect to server"
    );
    let pool = await sql.connect(config);
    console.log("connect complete");

    await pool
      .request()
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
      .query(
        "UPDATE cbs_sched" +
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
          " WHERE id = @id"
      );

    // let dateToShow = `${new Date(bookData.from_date)
    //     .toLocaleDateString('th-TH', {
    //         year: 'numeric',
    //         month: 'long',
    //         day: 'numeric',
    //         timeZone: "UTC",
    //     })} ${new Date(bookData.from_date)
    //         .toLocaleTimeString('th-TH', {
    //             hour: '2-digit',
    //             minute: '2-digit',
    //             timeZone: "UTC",
    //         })}น.`;

    // if (new Date(bookData.from_date).toUTCString().slice(0, -13) === new Date(bookData.to_date).toUTCString().slice(0, -13)) {
    //     dateToShow = dateToShow + ` - ${new Date(bookData.to_date)
    //         .toLocaleTimeString('th-TH', {
    //             hour: '2-digit',
    //             minute: '2-digit',
    //             timeZone: "UTC",
    //         })}น.`;
    // }
    // else {
    //     dateToShow = dateToShow + ` - ${new Date(bookData.to_date)
    //         .toLocaleDateString('th-TH', {
    //             year: 'numeric',
    //             month: 'long',
    //             day: 'numeric',
    //             timeZone: "UTC",
    //         })} ${new Date(bookData.to_date)
    //             .toLocaleTimeString('th-TH', {
    //                 hour: '2-digit',
    //                 minute: '2-digit',
    //                 timeZone: "UTC",
    //             })}น.`;
    // }

    // sendLineNotify({
    //     "message": "มีงานขออนุมัติใช้รถ" +
    //         "\nเลขที่: " + schedId +
    //         "\nผู้ขออนุมัติ: " + bookData.rcv_name +
    //         "\nแผนก: " + bookData.dept_name +
    //         "\nสถานที่: " + bookData.place +
    //         "\nเวลาเดินทาง: " + dateToShow +
    //         "\nรายละเอียด: " + bookData.detail
    // });

    console.log("reqPermit complete");
    console.log("====================");
    return { status: "ok" };
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function permitBook(bookData) {
  try {
    console.log(
      "permitBook call by " + bookData.permit_pid + " try connect to server"
    );
    let pool = await sql.connect(config);
    console.log("connect complete");

    await pool
      .request()
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
      .query(
        "UPDATE cbs_sched" +
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
          " WHERE id = @id"
      );

    if (bookData.grp_id) {
      console.log("update group sched");
      await pool
        .request()
        .input("id", sql.VarChar, bookData.grp_id)
        .input("drv_pid", sql.VarChar, bookData.drv_pid)
        .input("car_type_id", sql.TinyInt, bookData.car_type_id)
        .input("car_id", sql.TinyInt, bookData.car_id)
        .input("permit_pid", sql.VarChar, bookData.permit_pid)
        .query(
          "UPDATE cbs_sched_grp" +
            " SET status_id = 3" +
            ", drv_pid = @drv_pid" +
            ", car_type_id = @car_type_id" +
            ", car_id = @car_id" +
            ", permit_pid = @permit_pid" +
            ", permit_date = GETDATE()" +
            " WHERE id = @id"
        );
      console.log("update sched in group");
      await pool
        .request()
        .input("grp_id", sql.VarChar, bookData.grp_id)
        .input("drv_pid", sql.VarChar, bookData.drv_pid)
        .input("car_type_id", sql.TinyInt, bookData.car_type_id)
        .input("car_id", sql.TinyInt, bookData.car_id)
        .input("permit_pid", sql.VarChar, bookData.permit_pid)
        .query(
          "UPDATE cbs_sched" +
            " SET status_id = 3" +
            ", drv_pid = @drv_pid" +
            ", car_type_id = @car_type_id" +
            ", car_id = @car_id" +
            ", permit_pid = @permit_pid" +
            ", permit_date = GETDATE()" +
            " WHERE grp_id = @grp_id"
        );
    }

    let dateToShow = await createDateToShow(
      bookData.from_date,
      bookData.to_date
    );
    if (bookData.grp_id) {
      sendLineNotify({
        message:
          "มีการอนุมัติกลุ่มงาน" +
          "\nกลุ่มเลขที่: " +
          bookData.grp_id +
          "\nพนักงานขับรถ: " +
          bookData.drv_name +
          "\nรถที่ใช้: " +
          bookData.car_name +
          "\nเวลาเดินทาง: " +
          dateToShow,
      });
    } else {
      sendLineNotify({
        message:
          "มีการอนุมัติงาน" +
          "\nเลขที่: " +
          bookData.id +
          "\nพนักงานขับรถ: " +
          bookData.drv_name +
          "\nรถที่ขอใช้: " +
          bookData.car_name +
          "\nสถานที่: " +
          bookData.place +
          "\nจังหวัด: " +
          bookData.province +
          "\nเวลาเดินทาง: " +
          dateToShow +
          "\nผู้โดยสาร: " +
          bookData.pax_amt +
          " คน" +
          "\nผู้ขอ: " +
          bookData.req_name +
          "\nแผนก: " +
          bookData.dept_name +
          "\nเบอร์โทรติดต่อ: " +
          (bookData.tel_no ? bookData.tel_no : "ไม่ได้ระบุ") +
          "\nรายละเอียด: " +
          bookData.detail,
      });
    }

    console.log("permitBook complete");
    console.log("====================");
    return { status: "ok" };
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function bypassBook(bookData) {
  try {
    console.log(
      "bypassBook call by " + bookData.permit_pid + " try connect to server"
    );
    let pool = await sql.connect(config);
    console.log("connect complete");

    await pool
      .request()
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
      .input("rcv_pid", sql.VarChar, bookData.rcv_pid)
      .query(
        "UPDATE cbs_sched" +
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
          ", rcv_pid = @rcv_pid" +
          ", rcv_date = GETDATE()" +
          " WHERE id = @id"
      );

    let dateToShow = await createDateToShow(
      bookData.from_date,
      bookData.to_date
    );

    sendLineNotify({
      message:
        "มีการอนุมัติงาน" +
        "\nเลขที่: " +
        bookData.id +
        "\nพนักงานขับรถ: " +
        bookData.drv_name +
        "\nรถที่ขอใช้: " +
        bookData.car_name +
        "\nสถานที่: " +
        bookData.place +
        "\nจังหวัด: " +
        bookData.province +
        "\nเวลาเดินทาง: " +
        dateToShow +
        "\nผู้โดยสาร: " +
        bookData.pax_amt +
        " คน" +
        "\nผู้ขอ: " +
        bookData.req_name +
        "\nแผนก: " +
        bookData.dept_name +
        "\nเบอร์โทรติดต่อ: " +
        (bookData.tel_no ? bookData.tel_no : "ไม่ได้ระบุ") +
        "\nรายละเอียด: " +
        bookData.detail,
    });

    console.log("bypassBook complete");
    console.log("====================");
    return { status: "ok" };
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function denyBook(bookData) {
  try {
    console.log(
      "denyBook call by " + bookData.permit_pid + " try connect to server"
    );
    let pool = await sql.connect(config);
    console.log("connect complete");

    await pool
      .request()
      .input("id", sql.VarChar, bookData.id)
      .input("permit_pid", sql.VarChar, bookData.permit_pid)
      .input("note", sql.Text, bookData.note)
      .query(
        "UPDATE cbs_sched" +
          " SET proc_pid = @permit_pid" +
          ", proc_date = GETDATE()" +
          ", note = @note" +
          ", status_id = 0" +
          " WHERE id = @id"
      );

    console.log("denyBook complete");
    console.log("====================");
    return { status: "ok" };
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function delGrpSched(bookData) {
  try {
    console.log(
      "delGrpSched call id = " + bookData.id + ", try connect to server"
    );
    let pool = await sql.connect(config);
    console.log("connect complete");
    await pool
      .request()
      .input("id", sql.VarChar, bookData.id)
      .query(
        "UPDATE cbs_sched SET grp_id = null, status_id = 1 WHERE id = @id"
      );

    const grpSched = await getSchedByGrpId(bookData.grp_id);
    if (grpSched.length > 1) {
      let fromDate = "";
      let toDate = "";
      for (let i = 0; i < grpSched.length; i += 1) {
        if (fromDate === "" || grpSched[i].from_date < fromDate) {
          fromDate = grpSched[i].from_date;
        }
        if (toDate === "" || grpSched[i].to_date > toDate) {
          toDate = grpSched[i].to_date;
        }
      }

      console.log("update datetime in cbs_sched_grp");
      await pool
        .request()
        .input("id", sql.VarChar, bookData.grp_id)
        .input("from_date", sql.SmallDateTime, fromDate)
        .input("to_date", sql.SmallDateTime, toDate)
        .query(
          "UPDATE cbs_sched_grp" +
            " SET from_date = @from_date," +
            " to_date = @to_date" +
            " WHERE id = @id"
        );
    } else {
      console.log(
        "change group status to 'Cancel' due to <2 book left in this group"
      );
      await pool
        .request()
        .input("id", sql.VarChar, bookData.grp_id)
        .query(
          "UPDATE cbs_sched_grp" + " SET status_id = 0" + " WHERE id = @id"
        );
      await pool
        .request()
        .input("grp_id", sql.VarChar, bookData.grp_id)
        .query("UPDATE cbs_sched SET grp_id = null WHERE grp_id = @grp_id");
    }

    sendLineNotify({
      message:
        "มีการลบคำขอใช้รถออกจากกลุ่มงาน" +
        "\nกลุ่มงานเลขที่: " +
        bookData.grp_id +
        "\nเลขที่คำขอใช้รถที่ลบ: " +
        bookData.id +
        "\nผู้ลบ: " +
        bookData.req_name,
    });

    console.log("delGrpSched complete");
    console.log("====================");
    return { status: "ok" };
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function savChgSched(bookData) {
  try {
    console.log(
      "savChgSched call id = " + bookData.id + " try connect to server"
    );
    let pool = await sql.connect(config);
    console.log("connect complete");

    await pool
      .request()
      .input("id", sql.VarChar, bookData.id)
      .input("from_date", sql.SmallDateTime, bookData.from_date)
      .input("to_date", sql.SmallDateTime, bookData.to_date)
      .input("place", sql.VarChar, bookData.place)
      .input("province", sql.VarChar, bookData.province)
      .input("pax_amt", sql.TinyInt, bookData.pax_amt ? bookData.pax_amt : 0)
      .input("tel_no", sql.VarChar, bookData.tel_no ? bookData.tel_no : "")
      .input("detail", sql.Text, bookData.detail)
      .input("drv_pid", sql.VarChar, bookData.drv_pid)
      .input("car_type_id", sql.TinyInt, bookData.car_type_id)
      .input("car_id", sql.TinyInt, bookData.car_id)
      .input("dept_id", sql.VarChar, bookData.dept_id)
      .query(
        "UPDATE cbs_sched" +
          " SET from_date = @from_date" +
          ", to_date = @to_date" +
          ", place = @place" +
          ", province = @province" +
          ", pax_amt = @pax_amt" +
          ", tel_no = @tel_no" +
          ", detail = @detail" +
          ", drv_pid = @drv_pid" +
          ", car_type_id = @car_type_id" +
          ", car_id = @car_id" +
          ", dept_id = @dept_id" +
          " WHERE id = @id"
      );

    if (bookData.grp_id) {
      console.log("update group sched");
      await pool
        .request()
        .input("id", sql.VarChar, bookData.grp_id)
        .input("drv_pid", sql.VarChar, bookData.drv_pid)
        .input("car_type_id", sql.TinyInt, bookData.car_type_id)
        .input("car_id", sql.TinyInt, bookData.car_id)
        .query(
          "UPDATE cbs_sched_grp" +
            " SET drv_pid = @drv_pid" +
            ", car_type_id = @car_type_id" +
            ", car_id = @car_id" +
            " WHERE id = @id"
        );
      console.log("update sched in group");
      await pool
        .request()
        .input("grp_id", sql.VarChar, bookData.grp_id)
        .input("drv_pid", sql.VarChar, bookData.drv_pid)
        .input("car_type_id", sql.TinyInt, bookData.car_type_id)
        .input("car_id", sql.TinyInt, bookData.car_id)
        .query(
          "UPDATE cbs_sched" +
            " SET drv_pid = @drv_pid" +
            ", car_type_id = @car_type_id" +
            ", car_id = @car_id" +
            " WHERE grp_id = @grp_id"
        );
    }

    console.log("savChgSched complete");
    console.log("====================");
    return { status: "ok" };
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function useRecBook(bookData) {
  try {
    console.log(
      "useRecBook call by " + bookData.rec_pid + " try connect to server"
    );
    let pool = await sql.connect(config);
    console.log("connect complete");

    let qryText =
      " SET rec_pid = @rec_pid" +
      ", dep_date = @dep_date" +
      ", dep_mi = @dep_mi" +
      ", arr_date = @arr_date" +
      ", arr_mi = @arr_mi" +
      ", rec_date = GETDATE()" +
      ", car_type_id = @car_type_id" +
      ", car_id = @car_id" +
      ", drv_pid = @drv_pid";

    if (bookData.dep_mi && bookData.arr_mi) {
      qryText += ", status_id = 4";
    }

    if (bookData.grp_id) {
      console.log("update group");
      await pool
        .request()
        .input("id", sql.VarChar, bookData.grp_id)
        .input("rec_pid", sql.VarChar, bookData.rec_pid)
        .input("dep_date", sql.SmallDateTime, bookData.dep_date)
        .input("dep_mi", sql.Int, bookData.dep_mi)
        .input("arr_date", sql.SmallDateTime, bookData.arr_date)
        .input("arr_mi", sql.Int, bookData.arr_mi)
        .input("car_type_id", sql.TinyInt, bookData.car_type_id)
        .input("car_id", sql.TinyInt, bookData.car_id)
        .input("drv_pid", sql.VarChar, bookData.drv_pid)
        .query("UPDATE cbs_sched_grp " + qryText + " WHERE id = @id");

      console.log("update sched in group");
      await pool
        .request()
        .input("grp_id", sql.VarChar, bookData.grp_id)
        .input("rec_pid", sql.VarChar, bookData.rec_pid)
        .input("dep_date", sql.SmallDateTime, bookData.dep_date)
        .input("dep_mi", sql.Int, bookData.dep_mi)
        .input("arr_date", sql.SmallDateTime, bookData.arr_date)
        .input("arr_mi", sql.Int, bookData.arr_mi)
        .input("car_type_id", sql.TinyInt, bookData.car_type_id)
        .input("car_id", sql.TinyInt, bookData.car_id)
        .input("drv_pid", sql.VarChar, bookData.drv_pid)
        .query("UPDATE cbs_sched " + qryText + " WHERE grp_id = @grp_id");
    } else {
      await pool
        .request()
        .input("id", sql.VarChar, bookData.id)
        .input("rec_pid", sql.VarChar, bookData.rec_pid)
        .input("dep_date", sql.SmallDateTime, bookData.dep_date)
        .input("dep_mi", sql.Int, bookData.dep_mi)
        .input("arr_date", sql.SmallDateTime, bookData.arr_date)
        .input("arr_mi", sql.Int, bookData.arr_mi)
        .input("car_type_id", sql.TinyInt, bookData.car_type_id)
        .input("car_id", sql.TinyInt, bookData.car_id)
        .input("drv_pid", sql.VarChar, bookData.drv_pid)
        .query("UPDATE cbs_sched " + qryText + " WHERE id = @id");
    }

    console.log("useRecBook complete");
    console.log("====================");
    return { status: "ok" };
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
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
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function getAllDept() {
  console.log("let getAllDept");
  const result = await fetch(
    `http://${process.env.backendHost}:${process.env.himsPort}/api/himspsn/getalldept`
  )
    .then((response) => response.json())
    .then((data) => {
      console.log("getAllDept complete");
      return data;
    })
    .catch((error) => {
      if (error.name === "AbortError") {
        console.log("cancelled");
      } else {
        console.error("Error:", error);
      }
    });
  return result;
}

async function getFilteredCar(fromDate, toDate, schedId) {
  try {
    console.log("getFilteredCar call try connect to server");
    let pool = await sql.connect(config);
    console.log("connect complete");

    const busyCarQuery = await pool
      .request()
      .input("from_date", sql.SmallDateTime, fromDate)
      .input("to_date", sql.SmallDateTime, toDate)
      .query(
        "SELECT id, car_id, dept_id FROM cbs_sched WHERE ((@from_date BETWEEN from_date AND to_date)" +
          " OR" +
          " (@to_date BETWEEN from_date AND to_date)" +
          " OR" +
          " (@from_date <= from_date AND @to_date >= to_date))" +
          " AND car_id IS NOT NULL AND status_id <> 0"
      );
    const busyCar = busyCarQuery.recordsets[0];
    const car = await pool
      .request()
      .query(
        "SELECT cbs_car.id, cbs_car.type_id, cbs_car.reg_no, cbs_car.name FROM cbs_car"
      );
    let filteredCar = car.recordsets[0];
    const deptQry = await getAllDept();

    for (let i = 0; i < busyCar.length; i += 1) {
      for (let n = 0; n < filteredCar.length; n += 1) {
        if (
          busyCar[i].car_id === filteredCar[n].id &&
          busyCar[i].id !== schedId
        ) {
          if (filteredCar[n].duplicate) {
            await Object.assign(filteredCar[n], {
              duplicate: filteredCar[n].duplicate + ", " + busyCar[i].id,
              dept_name:
                filteredCar[n].dept_name +
                ", " +
                deptQry.find((o) => o.dept_id === busyCar[i].dept_id).dept_name,
            });
          } else {
            await Object.assign(filteredCar[n], {
              duplicate: busyCar[i].id,
              dept_name: deptQry.find((o) => o.dept_id === busyCar[i].dept_id)
                .dept_name,
            });
          }
        }
      }
    }

    console.log("getFilteredCar complete");
    console.log("====================");
    return filteredCar;
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function getCar() {
  try {
    console.log("getCar call try connect to server");
    let pool = await sql.connect(config);
    console.log("connect complete");
    const result = await pool
      .request()
      .query(
        "SELECT cbs_car.id, cbs_car.type_id, cbs_car.reg_no, cbs_car.name FROM cbs_car"
      );
    console.log("getCar complete");
    console.log("====================");
    return result.recordsets[0];
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function getDriver() {
  try {
    console.log("getDriver call try connect to server");
    let pool = await sql.connect(config);
    console.log("connect complete");
    console.log("get driver pid from hostDB");
    const temp = await pool
      .request()
      .query(
        "SELECT psn_lv_list.psn_id FROM psn_lv_list WHERE lv_id = 'CBS_DRV'"
      );
    const drvList = temp.recordsets[0];

    const psnList = await getAllPSNData();

    let result = [];
    result.push(
      {
        id: "0",
        name: "ไม่ระบุ",
      },
      {
        id: "1",
        name: "ผู้ขอใช้ขับเอง",
      }
    );
    for (let i = 0; i < drvList.length; i += 1) {
      const prename = psnList.find((o) => o.psn_id === drvList[i].psn_id).pname;
      const name = psnList.find((o) => o.psn_id === drvList[i].psn_id).fname;
      const surname = psnList.find((o) => o.psn_id === drvList[i].psn_id).lname;
      result.push({
        id: drvList[i].psn_id,
        name: prename + "" + name + " " + surname,
      });
    }
    console.log("getDriver complete");
    console.log("====================");
    return result;
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function getGrpPlaceList() {
  try {
    console.log("getGrpPlaceList call, try connect to server");
    let pool = await sql.connect(config);
    console.log("connect complete");
    const temp = await pool
      .request()
      .query(
        "SELECT cbs_sched.grp_id, cbs_sched.place FROM cbs_sched" +
          " LEFT JOIN cbs_sched_grp ON cbs_sched_grp.id = cbs_sched.grp_id" +
          " WHERE cbs_sched.grp_id IS NOT NULL"
      );
    console.log("getGrpPlaceList complete");
    console.log("====================");
    return temp.recordsets[0];
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function addPSNName(result) {
  console.log("get personnel data from hims");
  const psnList = await getAllPSNData();

  console.log("push personnel name into data");
  for (let i = 0; i < psnList.length; i += 1) {
    for (let n = 0; n < result.length; n += 1) {
      if (result[n].drv_pid === "0") {
        await Object.assign(result[n], { drv_name: "ไม่ระบุ" });
      }
      if (result[n].drv_pid === "1") {
        await Object.assign(result[n], { drv_name: "ขับเอง" });
      }
      if (psnList[i].psn_id === result[n].req_pid) {
        await Object.assign(result[n], {
          req_name:
            psnList[i].pname + "" + psnList[i].fname + " " + psnList[i].lname,
        });
      }
      if (psnList[i].psn_id === result[n].drv_pid) {
        await Object.assign(result[n], {
          drv_name:
            psnList[i].pname + "" + psnList[i].fname + " " + psnList[i].lname,
        });
      }
      if (psnList[i].psn_id === result[n].rcv_pid) {
        await Object.assign(result[n], {
          rcv_name:
            psnList[i].pname + "" + psnList[i].fname + " " + psnList[i].lname,
        });
      }
      if (psnList[i].psn_id === result[n].permit_pid) {
        await Object.assign(result[n], {
          permit_name:
            psnList[i].pname + "" + psnList[i].fname + " " + psnList[i].lname,
        });
      }
      if (psnList[i].psn_id === result[n].rec_pid) {
        await Object.assign(result[n], {
          rec_name:
            psnList[i].pname + "" + psnList[i].fname + " " + psnList[i].lname,
        });
      }
      if (psnList[i].psn_id === result[n].proc_pid) {
        await Object.assign(result[n], {
          proc_name:
            psnList[i].pname + "" + psnList[i].fname + " " + psnList[i].lname,
        });
      }
    }
  }
  return result;
}

async function addDeptName(result) {
  console.log("get department data from hims");
  const deptList = await getAllDept();

  console.log("push department name into data");
  for (let i = 0; i < deptList.length; i += 1) {
    for (let n = 0; n < result.length; n += 1) {
      if (deptList[i].dept_id === result[n].dept_id) {
        await Object.assign(result[n], {
          dept_name: deptList[i].dept_name,
          fac_name: deptList[i].fac_name,
        });
      }
    }
  }
  return result;
}

const schedQueryText =
  "SELECT cbs_sched.*" +
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
    const schedData = await pool
      .request()
      .query(schedQueryText + "ORDER BY cbs_sched.id DESC");
    let result = await addPSNName(schedData.recordsets[0]);
    result = await addDeptName(result);
    console.log("getAllSched complete");
    console.log("====================");
    return result;
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function getSchedByDate(date) {
  try {
    console.log(
      "getSchedByDate date = " + date + " call try connect to server"
    );
    let pool = await sql.connect(config);
    console.log("connect complete");
    const tmpDate = date !== "0" ? `'${date}'` : "GETDATE()";
    const schedData = await pool
      .request()
      .query(
        schedQueryText +
          "WHERE (DATEDIFF(d, from_date, " +
          tmpDate +
          ") = 0) ORDER BY cbs_sched.id DESC"
      );
    let result = await addPSNName(schedData.recordsets[0]);
    result = await addDeptName(result);
    console.log("getSchedByDate complete");
    console.log("====================");
    return result;
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function getAllSchedNonGrp() {
  try {
    console.log("getAllSchedNonGrp call try connect to server");
    let pool = await sql.connect(config);
    console.log("connect complete");
    const schedData = await pool
      .request()
      .query(
        schedQueryText +
          "WHERE cbs_sched.grp_id IS NULL AND cbs_sched.status_id <> 0 AND cbs_sched.status_id <> 4 ORDER BY cbs_sched.id DESC"
      );
    let result = await addPSNName(schedData.recordsets[0]);
    result = await addDeptName(result);
    console.log("getAllSchedNonGrp complete");
    console.log("====================");
    return result;
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function getSchedByReqId(req_pid) {
  try {
    console.log(
      "getSchedByReqId call by " + req_pid + " try connect to server"
    );
    let pool = await sql.connect(config);
    console.log("connect complete");
    const schedData = await pool
      .request()
      .input("req_pid", sql.VarChar, req_pid)
      .query(
        schedQueryText + "WHERE req_pid = @req_pid ORDER BY cbs_sched.id DESC"
      );
    let result = await addPSNName(schedData.recordsets[0]);
    result = await addDeptName(result);
    console.log("getSchedByReqId complete");
    console.log("====================");
    return result;
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function getSchedByDeptId(view_id, id) {
  try {
    console.log("getSchedByDeptId try connect to server");
    let pool = await sql.connect(config);
    console.log("connect complete");

    // temporary use wait to migrate to hims database
    let himsPsnDept = await fetch(
      `http://${process.env.backendHost}:${process.env.himsPort}/api/himspsn/getpsndatabyid/${id}`
    )
      .then((response) => response.json())
      .then((data) => {
        return data.dept_id;
      })
      .catch((error) => {
        if (error.name === "AbortError") {
          console.log("cancelled");
        } else {
          console.error("Error:", error);
        }
      });
    // let limitChk = himsPsnDept;
    // end of temporary code

    // let limitChk = dept_id;
    if (view_id === "MGR") {
      himsPsnDept = himsPsnDept.slice(0, 3);
    } else if (view_id === "HMGR") {
      himsPsnDept = himsPsnDept.slice(0, 1);
    } else if (view_id === "ALL") {
      himsPsnDept = "";
    }

    const schedData = await pool
      .request()
      .query(
        schedQueryText +
          " WHERE cbs_sched.dept_id LIKE '" +
          himsPsnDept +
          "%' ORDER BY cbs_sched.id DESC"
      );
    let result = await addPSNName(schedData.recordsets[0]);
    result = await addDeptName(result);

    console.log("getSchedByDeptId complete");
    console.log("====================");
    return result;
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function getSchedByGrpId(grp_id) {
  try {
    console.log(
      "getSchedByGrpId call id = " + grp_id + ", try connect to server"
    );
    let pool = await sql.connect(config);
    console.log("connect complete");

    const schedGrpData = await pool
      .request()
      .input("grp_id", sql.VarChar, grp_id)
      .query(schedQueryText + " WHERE grp_id = @grp_id");
    let result = await addPSNName(schedGrpData.recordsets[0]);
    result = await addDeptName(result);

    console.log("getSchedByGrpId complete");
    console.log("====================");
    return result;
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function getSchedIdinGrpId(grp_id) {
  try {
    console.log(
      "getSchedIdinGrpId call grp_id = " + grp_id + ", try connect to server"
    );
    let pool = await sql.connect(config);
    console.log("connect complete");

    const schedIdList = await pool
      .request()
      .input("grp_id", sql.VarChar, grp_id)
      .query("SELECT id FROM cbs_sched WHERE grp_id = @grp_id");
    const temp = schedIdList.recordsets[0];
    let result = "";
    for (let i = 0; i < temp.length; i += 1) {
      result += temp[i].id + "" + (i + 1 < temp.length ? ", " : "");
    }
    console.log("getSchedIdinGrpId complete");
    return result;
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function getSchedGrp() {
  try {
    console.log("getSchedGrp call try connect to server");
    let pool = await sql.connect(config);
    console.log("connect complete");

    const schedGrpData = await pool
      .request()
      .query(
        "SELECT" +
          " cbs_sched_grp.*" +
          ", cbs_sched_status.name AS status_name" +
          ", cbs_car_type.name AS car_type_name" +
          ", cbs_car.name AS car_name" +
          ", cbs_car.reg_no AS car_reg_no" +
          " FROM cbs_sched_grp" +
          " LEFT JOIN cbs_car_type ON cbs_car_type.id = cbs_sched_grp.car_type_id" +
          " LEFT JOIN cbs_car ON cbs_car.id = cbs_sched_grp.car_id" +
          " LEFT JOIN cbs_sched_status ON cbs_sched_status.id = cbs_sched_grp.status_id" +
          " WHERE" +
          " cbs_sched_grp.status_id <> 4 AND cbs_sched_grp.status_id <> 0 "
      );
    let result = await addPSNName(schedGrpData.recordsets[0]);
    console.log("getSchedGrp complete");
    console.log("====================");
    return result;
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

// async function getSchedGrpById(id) {
// try {
//   console.log("getSchedGrpById call try connect to server");
//   let pool = await sql.connect(config);
//   console.log("connect complete");

//   const schedGrpData = await pool
//     .request()
//     .input("id", sql.VarChar, id)
//     .query(
//       "SELECT" +
//         " cbs_sched_grp.*" +
//         ", cbs_sched_status.name AS status_name" +
//         ", cbs_car_type.name AS car_type_name" +
//         ", cbs_car.name AS car_name" +
//         ", cbs_car.reg_no AS car_reg_no" +
//         " FROM cbs_sched_grp" +
//         " LEFT JOIN cbs_car_type ON cbs_car_type.id = cbs_sched_grp.car_type_id" +
//         " LEFT JOIN cbs_car ON cbs_car.id = cbs_sched_grp.car_id" +
//         " LEFT JOIN cbs_sched_status ON cbs_sched_status.id = cbs_sched_grp.status_id" +
//         " WHERE" +
//         " cbs_sched_grp.status_id <> 4 AND cbs_sched_grp.status_id <> 0 AND cbs_sched_grp.id = @id "
//     );
//   let result = await addPSNName(schedGrpData.recordsets[0]);
//   console.log("getSchedGrpById complete");
//   console.log("====================");
//   return result;
// } catch (error) {
//   console.error(error);
//   return { status: "error", message: error.message };
// }
// }

async function getPermitReqSched() {
  try {
    console.log("getPermitReqSched call try connect to server");
    let pool = await sql.connect(config);
    console.log("connect complete");
    const schedData = await pool
      .request()
      .query(
        schedQueryText +
          "WHERE cbs_sched.status_id = 1 ORDER BY cbs_sched.id DESC"
      );
    let result = await addPSNName(schedData.recordsets[0]);
    result = await addDeptName(result);
    console.log("getPermitReqSched complete");
    console.log("====================");
    return result;
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function getPermitSched() {
  try {
    console.log("getPermitSched call try connect to server");
    let pool = await sql.connect(config);
    console.log("connect complete");
    const schedData = await pool
      .request()
      .query(
        schedQueryText +
          "WHERE cbs_sched.status_id = 2 ORDER BY cbs_sched.id DESC"
      );
    let result = await addPSNName(schedData.recordsets[0]);
    result = await addDeptName(result);
    console.log("getPermitSched complete");
    console.log("====================");
    return result;
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function getDrvSched() {
  try {
    console.log("getDrvSched call try connect to server");
    let pool = await sql.connect(config);
    console.log("connect complete");
    const schedData = await pool
      .request()
      .query(
        schedQueryText +
          "WHERE cbs_sched.status_id = 3" +
          " AND ( dep_date IS NULL OR dep_mi IS NULL OR arr_date IS NULL OR arr_mi IS NULL )" +
          " ORDER BY cbs_sched.id DESC"
      );
    let result = await addPSNName(schedData.recordsets[0]);
    result = await addDeptName(result);
    console.log("getDrvSched complete");
    console.log("====================");
    return result;
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function getUsrDrvSched(pid) {
  try {
    console.log(
      "getUsrDrvSched call with pid = " + pid + ", try connect to server"
    );
    let pool = await sql.connect(config);
    console.log("connect complete");
    const schedData = await pool
      .request()
      .input("req_pid", sql.VarChar, pid)
      .query(
        schedQueryText +
          "WHERE cbs_sched.status_id = 3 AND cbs_sched.req_pid = @req_pid" +
          " AND ( dep_date IS NULL OR dep_mi IS NULL OR arr_date IS NULL OR arr_mi IS NULL )" +
          " ORDER BY cbs_sched.id DESC"
      );
    let result = await addPSNName(schedData.recordsets[0]);
    result = await addDeptName(result);
    console.log("getUsrDrvSched complete");
    console.log("====================");
    return result;
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
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
        ", COUNT(CASE WHEN status_id = 4 then 1 END) AS 'complete'" +
        " FROM cbs_sched"
      // " WHERE from_date >= GETDATE()"
    );
    // let result = taskCntr.recordset[0];
    // const carCntr = await pool
    //   .request()
    //   .query("SELECT COUNT(id) AS 'car_amt'" + " FROM cbs_car");
    // await Object.assign(result, { car_amt: carCntr.recordset[0].car_amt });
    console.log("getStatCntr complete");
    console.log("====================");
    return taskCntr.recordset[0];
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function getCalendarCntr() {
  try {
    console.log("getCalendarCntr try connect to server");
    let pool = await sql.connect(config);
    console.log("connect complete");
    const taskCntr = await pool
      .request()
      .query(
        "SELECT CAST(Convert(date, from_date) AS VARCHAR) as date" +
          ", COUNT(CASE WHEN status_id = 1 then 1 END) AS 'request'" +
          ", COUNT(CASE WHEN status_id = 2 then 1 END) AS 'permitRep'" +
          ", COUNT(CASE WHEN status_id = 3 then 1 END) AS 'permit'" +
          ", COUNT(CASE WHEN status_id = 4 then 1 END) AS 'complete'" +
          " FROM cbs_sched" +
          " GROUP BY Convert(date, from_date)"
      );
    console.log("getCalendarCntr complete");
    console.log("====================");
    return taskCntr.recordsets[0];
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function getNoti() {
  try {
    console.log("getNoti call try connect to server");
    let pool = await sql.connect(config);
    console.log("connect complete");
    let result = {};
    let temp = "";

    temp = await pool
      .request()
      .query("SELECT COUNT(id) AS permitReq FROM cbs_sched WHERE status_id = 1");
    await Object.assign(result, temp.recordset[0]);
    temp = await pool
      .request()
      .query("SELECT COUNT(id) AS permit FROM cbs_sched WHERE status_id = 2");
    await Object.assign(result, temp.recordset[0]);
    temp = await pool
      .request()
      .query("SELECT COUNT(id) AS useRec FROM cbs_sched WHERE status_id = 3");
    await Object.assign(result, temp.recordset[0]);
    console.log("getNoti complete");
    console.log("====================");
    return result;
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

async function getVersion() {
  try {
    return process.env.version;
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
}

module.exports = {
  carBook: carBook,
  mergeBook: mergeBook,
  mergeBookAdd: mergeBookAdd,
  reqPermit: reqPermit,
  denyBook: denyBook,
  delGrpSched: delGrpSched,
  savChgSched: savChgSched,
  permitBook: permitBook,
  bypassBook: bypassBook,
  useRecBook: useRecBook,
  getCarType: getCarType,
  getFilteredCar: getFilteredCar,
  getCar: getCar,
  getDriver: getDriver,
  getGrpPlaceList: getGrpPlaceList,
  getAllSched: getAllSched,
  getAllSchedNonGrp: getAllSchedNonGrp,
  getSchedByDate: getSchedByDate,
  getSchedByReqId: getSchedByReqId,
  getSchedByDeptId: getSchedByDeptId,
  getSchedGrp: getSchedGrp,
  // getSchedGrpById: getSchedGrpById,
  getSchedByGrpId: getSchedByGrpId,
  getSchedIdinGrpId: getSchedIdinGrpId,
  getPermitReqSched: getPermitReqSched,
  getPermitSched: getPermitSched,
  getDrvSched: getDrvSched,
  getUsrDrvSched: getUsrDrvSched,
  getStatCntr: getStatCntr,
  getCalendarCntr: getCalendarCntr,
  getNoti: getNoti,
  getVersion: getVersion,
};
