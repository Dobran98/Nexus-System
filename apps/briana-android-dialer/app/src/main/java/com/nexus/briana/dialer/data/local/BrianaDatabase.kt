package com.nexus.briana.dialer.data.local

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase

@Entity(tableName = "pending_telemetry")
data class PendingTelemetryEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val payloadJson: String,
    val createdAtMs: Long = System.currentTimeMillis()
)

@Dao
interface PendingTelemetryDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun enqueue(item: PendingTelemetryEntity)

    @Query("SELECT * FROM pending_telemetry ORDER BY createdAtMs ASC LIMIT 25")
    suspend fun getBatch(): List<PendingTelemetryEntity>

    @Query("DELETE FROM pending_telemetry WHERE id = :id")
    suspend fun deleteById(id: Long)
}

@Database(entities = [PendingTelemetryEntity::class], version = 1, exportSchema = false)
abstract class BrianaDatabase : RoomDatabase() {
    abstract fun pendingTelemetryDao(): PendingTelemetryDao

    companion object {
        @Volatile
        private var INSTANCE: BrianaDatabase? = null

        fun getInstance(context: Context): BrianaDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    BrianaDatabase::class.java,
                    "briana_outbox.db"
                ).build().also { INSTANCE = it }
            }
        }
    }
}

