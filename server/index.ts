import express, { Express, Request, Response } from "express";
import * as mysql from "mysql2";
import * as dotenv from "dotenv";
import cors from "cors";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import multer from "multer";

import { generateRandomString } from "./utils.ts";

interface Patient {
  id?: string;
  firstName: string;
  lastName: string;
  birthday: Date;
  imageUrl?: string;
  identifier?: string;
  description: string;
  primaryDoctor: string;
  image?: File | undefined | Blob;
}

dotenv.config();

const app: Express = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const s3 = new S3Client({
  region: process.env.S3_BUCKET || "us-east-1",
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID || "",
    secretAccessKey: process.env.SECRET_ACCESS_KEY || "",
  },
});

const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_NAME || "patients",
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
});

db.connect((err: Error | null) => {
  if (err) {
    console.error("Error connecting to RDS", err.message);
    return;
  }
  console.log("Connected to RDS successfully!");
});

// GET endpoint to retrieve patients data
app.get("/patients", (req: Request, res: Response) => {
  const query = "SELECT * FROM patients";
  db.query(
    query,
    (err: mysql.QueryError | null, results: Patient[] | undefined) => {
      if (err) {
        res
          .status(500)
          .json({ error: "Error fetching data from the database" });
      } else {
        const patientsWithImageUrls = results?.map((patient) => {
          if (!patient.identifier) return { ...patient, imageUrl: "" };
          const imageUrl = `${process.env.S3_BUCKET_URL}${patient.identifier}`;
          return { ...patient, imageUrl };
        });
        res.status(200).json(patientsWithImageUrls);
      }
    }
  );
});

// Retrieve a single patient by ID
app.get("/patients/:id", (req: Request<{ id: string }>, res: Response) => {
  const query = "SELECT * FROM patients WHERE id = ?";
  db.query(
    query,
    [req.params.id],
    (err: mysql.QueryError | null, results: mysql.RowDataPacket[]) => {
      if (err) {
        res
          .status(500)
          .json({ error: "Error fetching data from the database" });
      } else {
        const patient = results ? results[0] : null;
        if (patient) {
          if (patient.identifier) {
            patient.imageUrl = `${process.env.S3_BUCKET_URL}${patient.identifier}`;
          } else {
            patient.imageUrl = "";
          }
          res.status(200).json(patient);
        }
      }
    }
  );
});

app.post(
  "/patients",
  upload.single("image"),
  (req: Request<object, object, Patient>, res: Response) => {
    const { firstName, lastName, birthday, description, primaryDoctor } =
      req.body;
    const identifier = generateRandomString(10);
    if (!req?.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const bucketName = process.env.S3_BUCKET_NAME;
    const params = {
      Bucket: bucketName,
      Key: identifier,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };
    s3.send(new PutObjectCommand(params), (err) => {
      if (err) console.log(err);
    });
    const query =
      "INSERT INTO patients (firstName, lastName, birthday, description, primaryDoctor, identifier) VALUES (?, ?, ?, ?, ?, ?)";
    db.query(
      query,
      [
        firstName,
        lastName,
        new Date(birthday),
        description,
        primaryDoctor,
        identifier,
      ],
      (err: mysql.QueryError | null, result?: unknown) => {
        if (err) {
          res
            .status(500)
            .json({ error: "Error adding data to the database", err });
        } else {
          res.status(201).json({
            message: "Patient added successfully",
            patientId: (result as mysql.ResultSetHeader).insertId,
          });
        }
      }
    );
  }
);

// PUT route for updating patient information
app.put(
  "/patients/:id",
  upload.single("image"),
  (req: Request<{ id: string }>, res: Response) => {
    const { firstName, lastName, birthday, description, primaryDoctor } =
      req.body;
    const parsedBirthday =
      typeof birthday === "string" ? new Date(birthday) : birthday;

    if (!(parsedBirthday instanceof Date && !isNaN(parsedBirthday.getTime()))) {
      return res.status(400).json({ error: "Invalid birthday format" });
    }

    db.query(
      "SELECT identifier FROM patients WHERE id = ?",
      [req.params.id],
      (err, results) => {
        if (err) {
          return res
            .status(500)
            .json({ error: "Error retrieving current file identifier", err });
        }

        const parsedResults: { identifier: string }[] = results as {
          identifier: string;
        }[];

        const currentIdentifier = parsedResults?.[0]?.identifier;

        if (req.file) {
          const identifier = generateRandomString(10);
          const bucketName = process.env.S3_BUCKET_NAME;
          const params = {
            Bucket: bucketName,
            Key: identifier,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
          };

          s3.send(new PutObjectCommand(params), (err) => {
            if (err) {
              console.log(err);
              return res
                .status(500)
                .json({ error: "Error uploading file to S3", err });
            }

            updateDatabase(
              req,
              res,
              identifier,
              {
                firstName,
                lastName,
                birthday: parsedBirthday,
                description,
                primaryDoctor,
              },
              currentIdentifier
            );
          });
        } else {
          updateDatabase(
            req,
            res,
            "",
            {
              firstName,
              lastName,
              birthday: parsedBirthday,
              description,
              primaryDoctor,
            },
            currentIdentifier
          );
        }
      }
    );
  }
);
function deleteFileFromS3(fileIdentifier: string) {
  const bucketName = process.env.S3_BUCKET_NAME;
  const deleteParams = {
    Bucket: bucketName,
    Key: fileIdentifier,
  };
  s3.send(new DeleteObjectCommand(deleteParams), (err) => {
    if (err) {
      // console.log("Error deleting file from S3");
    }
  });
}

function updateDatabase(
  req: Request<{ id: string }>,
  res: Response,
  newFileIdentifier: string,
  patientData: Patient,
  oldFileIdentifier: string
) {
  const query =
    "UPDATE patients SET firstName = ?, lastName = ?, birthday = ?, description = ?, primaryDoctor = ?, identifier = ? WHERE id = ?";
  db.query(
    query,
    [
      patientData.firstName,
      patientData.lastName,
      patientData.birthday,
      patientData.description,
      patientData.primaryDoctor,
      newFileIdentifier || oldFileIdentifier,
      req.params.id,
    ],
    (err) => {
      if (err) {
        return res
          .status(500)
          .json({ error: "Error updating data in the database", err });
      }

      if (newFileIdentifier && oldFileIdentifier) {
        deleteFileFromS3(oldFileIdentifier);
      }

      res.status(200).json({ message: "Patient updated successfully" });
    }
  );
}

app.delete("/patients/:id", (req, res) => {
  const getFileIdentifierQuery = "SELECT identifier FROM patients WHERE id = ?";
  db.query(getFileIdentifierQuery, [req.params.id], (err, results) => {
    if (err) {
      return res.status(500).json({
        error: "Error retrieving file identifier from the database",
      });
    }

    const parsedResults: { identifier: string }[] = results as {
      identifier: string;
    }[];

    const fileIdentifier = parsedResults?.[0]?.identifier;

    // Function to delete the patient record from the database
    const deletePatientRecord = () => {
      const deletePatientQuery = "DELETE FROM patients WHERE id = ?";
      db.query(deletePatientQuery, [req.params.id], (err) => {
        if (err) {
          return res
            .status(500)
            .json({ error: "Error deleting patient data from the database" });
        }
        res.status(200).json({ message: "Patient deleted successfully" });
      });
    };

    // If a file identifier exists, delete the file from S3, then delete the patient record
    console.log(fileIdentifier);
    if (fileIdentifier) {
      deleteFileFromS3(fileIdentifier);
    }
    deletePatientRecord();
  });
});

// 404 Not Found handler for undefined routes
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// General error handler
app.use((err: Error, req: Request, res: Response) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

const PORT: number = parseInt(process.env.PORT || "5173");
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
